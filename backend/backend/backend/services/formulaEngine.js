/**
 * ============================================================
 * FORMULA ENGINE (formules de débit / nomenclature)
 * ============================================================
 * Client users type formulas such as
 *     (L - 2*jd + (n-1)*rc) / n
 *     ms == 1 ? 2 : 0
 *     if(L > 1500, 3, 2)
 *     ceil(2*(L+H)/1000 / 8)
 * into the chassis catalogue. These strings are NEVER passed to
 * eval/Function: this is a small recursive-descent parser that only
 * knows numbers, variables, arithmetic, comparisons, logic, the
 * ternary operator and a fixed whitelist of functions.
 *
 * Grammar (lowest to highest precedence):
 *   ternary  := or ( '?' ternary ':' ternary )?
 *   or       := and ( ('||' | 'or') and )*
 *   and      := cmp ( ('&&' | 'and') cmp )*
 *   cmp      := add ( ('=='|'!='|'<'|'<='|'>'|'>='|'=') add )?
 *   add      := mul ( ('+'|'-') mul )*
 *   mul      := pow ( ('*'|'/'|'%') pow )*
 *   pow      := unary ( '^' pow )?
 *   unary    := ('-'|'+'|'!'|'not') unary | call
 *   call     := IDENT '(' args ')' | IDENT | NUMBER | '(' ternary ')'
 *
 * Booleans are numbers (true = 1, false = 0) so a condition can be
 * reused in arithmetic: `2 + ms*2`.
 * ============================================================
 */

const FUNCTIONS = Object.assign(Object.create(null), {
  min: { min: 1, max: 99, fn: (...a) => Math.min(...a) },
  max: { min: 1, max: 99, fn: (...a) => Math.max(...a) },
  abs: { min: 1, max: 1, fn: (x) => Math.abs(x) },
  sqrt: { min: 1, max: 1, fn: (x) => Math.sqrt(x) },
  ceil: { min: 1, max: 1, fn: (x) => Math.ceil(x - 1e-9) },
  floor: { min: 1, max: 1, fn: (x) => Math.floor(x + 1e-9) },
  // round(x) or round(x, decimals)
  round: { min: 1, max: 2, fn: (x, d = 0) => { const f = 10 ** d; return Math.round(x * f) / f; } },
  // Round UP to a multiple: ceilto(1234, 50) = 1250 (standard lengths, pack sizes)
  ceilto: { min: 2, max: 2, fn: (x, s) => (s ? Math.ceil(x / s - 1e-9) * s : x) },
  floorto: { min: 2, max: 2, fn: (x, s) => (s ? Math.floor(x / s + 1e-9) * s : x) },
  if: { min: 3, max: 3, lazy: true },
  clamp: { min: 3, max: 3, fn: (x, a, b) => Math.min(Math.max(x, a), b) },
  // Angle helpers for sloped/arched frames (degrees)
  sin: { min: 1, max: 1, fn: (d) => Math.sin((d * Math.PI) / 180) },
  cos: { min: 1, max: 1, fn: (d) => Math.cos((d * Math.PI) / 180) },
  tan: { min: 1, max: 1, fn: (d) => Math.tan((d * Math.PI) / 180) },
  hyp: { min: 2, max: 2, fn: (a, b) => Math.hypot(a, b) },
});
// Null-prototype maps: "constructor", "__proto__"… are NOT functions/operators here.
const CONSTANTS = Object.assign(Object.create(null), { pi: Math.PI, true: 1, false: 0 });
const WORD_OPS = Object.assign(Object.create(null), { and: "&&", or: "||", not: "!" });

class FormulaError extends Error {
  constructor(message, position) {
    super(message);
    this.name = "FormulaError";
    this.position = position;
    this.status = 400;
  }
}

function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i += 1; continue; }
    // Numbers use a decimal POINT: the comma separates function arguments (max(1,2)).
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j += 1;
      if (j < src.length && /[eE]/.test(src[j]) && /[0-9+-]/.test(src[j + 1] || "")) {
        j += 2;
        while (j < src.length && /[0-9]/.test(src[j])) j += 1;
      }
      const text = src.slice(i, j);
      const value = Number(text);
      if (!Number.isFinite(value)) throw new FormulaError(`Invalid number "${text}"`, i);
      tokens.push({ type: "num", value, pos: i });
      i = j;
      continue;
    }
    if (/[A-Za-z_À-ÿ]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_À-ÿ]/.test(src[j])) j += 1;
      // Profile of the series by its code: DOR.ae, OUV.ch… (one name)
      while (src[j] === "." && /[A-Za-z_]/.test(src[j + 1] || "")) {
        j += 1;
        while (j < src.length && /[A-Za-z0-9_À-ÿ]/.test(src[j])) j += 1;
      }
      const word = src.slice(i, j);
      const lower = word.toLowerCase();
      if (lower in WORD_OPS) tokens.push({ type: "op", value: WORD_OPS[lower], pos: i });
      else tokens.push({ type: "id", value: word, pos: i });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (["<=", ">=", "==", "!=", "&&", "||"].includes(two)) {
      tokens.push({ type: "op", value: two, pos: i });
      i += 2;
      continue;
    }
    if ("+-*/%^()?:,<>!=".includes(c)) {
      tokens.push({ type: "op", value: c === "=" ? "==" : c, pos: i });
      i += 1;
      continue;
    }
    throw new FormulaError(`Unexpected character "${c}"`, i);
  }
  return tokens;
}

function parse(src) {
  if (typeof src !== "string" || !src.trim()) throw new FormulaError("Empty formula", 0);
  if (src.length > 1000) throw new FormulaError("Formula too long (1000 characters max)", 0);
  const tokens = tokenize(src);
  let p = 0;
  const peek = () => tokens[p];
  const isOp = (v) => peek() && peek().type === "op" && peek().value === v;
  const expect = (v) => {
    if (!isOp(v)) throw new FormulaError(`Expected "${v}"`, peek() ? peek().pos : src.length);
    p += 1;
  };

  function ternary() {
    const cond = or();
    if (isOp("?")) {
      p += 1;
      const a = ternary();
      expect(":");
      const b = ternary();
      return { t: "if", c: cond, a, b };
    }
    return cond;
  }
  function binary(next, ops) {
    return function level() {
      let left = next();
      while (peek() && peek().type === "op" && ops.includes(peek().value)) {
        const op = tokens[p].value;
        p += 1;
        left = { t: "bin", op, l: left, r: next() };
      }
      return left;
    };
  }
  function pow() {
    const base = unary();
    if (isOp("^")) {
      p += 1;
      return { t: "bin", op: "^", l: base, r: pow() };
    }
    return base;
  }
  function unary() {
    if (isOp("-") || isOp("+") || isOp("!")) {
      const op = tokens[p].value;
      p += 1;
      return { t: "un", op, v: unary() };
    }
    return primary();
  }
  function primary() {
    const tok = peek();
    if (!tok) throw new FormulaError("Unexpected end of formula", src.length);
    if (tok.type === "num") { p += 1; return { t: "num", v: tok.value }; }
    if (tok.type === "id") {
      p += 1;
      if (isOp("(")) {
        const name = tok.value.toLowerCase();
        const spec = FUNCTIONS[name];
        if (!spec) throw new FormulaError(`Unknown function "${tok.value}"`, tok.pos);
        p += 1;
        const args = [];
        if (!isOp(")")) {
          args.push(ternary());
          while (isOp(",")) { p += 1; args.push(ternary()); }
        }
        expect(")");
        if (args.length < spec.min || args.length > spec.max) {
          throw new FormulaError(`${name}() takes ${spec.min === spec.max ? spec.min : `${spec.min}-${spec.max}`} argument(s)`, tok.pos);
        }
        return { t: "call", name, args };
      }
      return { t: "var", name: tok.value };
    }
    if (isOp("(")) {
      p += 1;
      const e = ternary();
      expect(")");
      return e;
    }
    throw new FormulaError(`Unexpected "${tok.value}"`, tok.pos);
  }

  const mul = binary(pow, ["*", "/", "%"]);
  const add = binary(mul, ["+", "-"]);
  const cmp = binary(add, ["==", "!=", "<", "<=", ">", ">="]);
  const and = binary(cmp, ["&&"]);
  const or = binary(and, ["||"]);

  const ast = ternary();
  if (p < tokens.length) throw new FormulaError(`Unexpected "${tokens[p].value}"`, tokens[p].pos);
  return ast;
}

function lookup(name, vars) {
  if (Object.prototype.hasOwnProperty.call(vars, name)) return vars[name];
  const lower = name.toLowerCase();
  if (lower in CONSTANTS) return CONSTANTS[lower];
  // Variables are case-sensitive (L ≠ l would be confusing only for
  // L/H, so accept the other case for those two).
  if (name === "l" && vars.L !== undefined) return vars.L;
  if (name === "h" && vars.H !== undefined) return vars.H;
  throw new FormulaError(`Unknown variable "${name}"`);
}

function num(v) {
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function evalNode(node, vars) {
  switch (node.t) {
    case "num": return node.v;
    case "var": return num(lookup(node.name, vars));
    case "un": {
      const v = evalNode(node.v, vars);
      if (node.op === "-") return -v;
      if (node.op === "!") return v ? 0 : 1;
      return v;
    }
    case "if": return evalNode(node.c, vars) ? evalNode(node.a, vars) : evalNode(node.b, vars);
    case "call": {
      if (node.name === "if") return evalNode(node.args[0], vars) ? evalNode(node.args[1], vars) : evalNode(node.args[2], vars);
      return FUNCTIONS[node.name].fn(...node.args.map((a) => evalNode(a, vars)));
    }
    case "bin": {
      if (node.op === "&&") return evalNode(node.l, vars) && evalNode(node.r, vars) ? 1 : 0;
      if (node.op === "||") return evalNode(node.l, vars) || evalNode(node.r, vars) ? 1 : 0;
      const a = evalNode(node.l, vars);
      const b = evalNode(node.r, vars);
      switch (node.op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": if (b === 0) throw new FormulaError("Division by zero"); return a / b;
        case "%": if (b === 0) throw new FormulaError("Division by zero"); return a % b;
        case "^": return a ** b;
        case "==": return Math.abs(a - b) < 1e-9 ? 1 : 0;
        case "!=": return Math.abs(a - b) >= 1e-9 ? 1 : 0;
        case "<": return a < b ? 1 : 0;
        case "<=": return a <= b + 1e-9 ? 1 : 0;
        case ">": return a > b ? 1 : 0;
        case ">=": return a >= b - 1e-9 ? 1 : 0;
        default: throw new FormulaError(`Unknown operator ${node.op}`);
      }
    }
    default: throw new FormulaError("Invalid formula");
  }
}

const cache = new Map();
function compile(src) {
  const key = String(src);
  let ast = cache.get(key);
  if (!ast) {
    ast = parse(key);
    if (cache.size > 5000) cache.clear();
    cache.set(key, ast);
  }
  return ast;
}

/** Evaluates `src` with `vars`. Empty / null formula → `fallback`. */
function evaluate(src, vars = {}, fallback = 0) {
  if (src === null || src === undefined || String(src).trim() === "") return fallback;
  if (typeof src === "number") return src;
  const value = evalNode(compile(String(src)), vars);
  if (!Number.isFinite(value)) throw new FormulaError("The result is not a finite number");
  return value;
}

function collectVars(node, out = new Set()) {
  if (!node) return out;
  if (node.t === "var") out.add(node.name);
  if (node.l) collectVars(node.l, out);
  if (node.r) collectVars(node.r, out);
  if (node.v && typeof node.v === "object") collectVars(node.v, out);
  if (node.c) collectVars(node.c, out);
  if (node.a) collectVars(node.a, out);
  if (node.b) collectVars(node.b, out);
  if (node.args) node.args.forEach((a) => collectVars(a, out));
  return out;
}

/**
 * Syntax + variable check for the editor. `known` = variable names
 * that will exist at run time (L, H, parameters, series variables,
 * derived values). Returns { ok, error?, variables }.
 */
function check(src, known = null) {
  try {
    const ast = compile(String(src));
    const variables = [...collectVars(ast)].filter((v) => !(v.toLowerCase() in CONSTANTS));
    if (known) {
      const set = new Set(known);
      const unknown = variables.filter((v) => !set.has(v) && !(v === "l" && set.has("L")) && !(v === "h" && set.has("H")));
      if (unknown.length) return { ok: false, error: `Unknown variable "${unknown[0]}"`, variables };
    }
    return { ok: true, variables };
  } catch (error) {
    return { ok: false, error: error.message, position: error.position, variables: [] };
  }
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]{0,30}$/;
const RESERVED = new Set([...Object.keys(FUNCTIONS), ...Object.keys(CONSTANTS), ...Object.keys(WORD_OPS), "L", "H", "Q"]);
/** Is `key` usable as a parameter / variable name? */
function isValidVariableName(key) {
  return IDENT.test(String(key || "")) && !RESERVED.has(String(key).toLowerCase()) && !RESERVED.has(String(key));
}

module.exports = { evaluate, check, compile, isValidVariableName, FormulaError, FUNCTIONS: Object.keys(FUNCTIONS) };
