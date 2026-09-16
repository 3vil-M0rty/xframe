import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Package,
  Boxes,
  Factory,
  Layers,
  Search,
  Plus,
  Edit,
  Trash2,
  Archive,
  X,
} from "lucide-react";

import { useI18n } from "../../hooks/useI18n";

import Breadcrumbs from "../../components/useful/Breadcrumbs";
import SearchBar from "../../components/useful/SearchBar";
import Pagination from "../../components/useful/Pagination";
import ActionModal from "../../components/useful/ActionModal";
import StatusPill from "../../components/useful/StatusPill";

import styles from "./Inventory.module.css";

const PAGE_SIZE = 24;

/* ============================================================
   INVENTORIES

   These are intentionally frontend definitions for now.

   Later each inventory will have its own model and these
   values can come from the backend.
   ============================================================ */

const INVENTORIES = [
  {
    key: "finished-products",
    icon: Package,
  },
  {
    key: "raw-materials",
    icon: Factory,
  },
  {
    key: "packaging",
    icon: Boxes,
  },
  {
    key: "consumables",
    icon: Layers,
  },
];

/* ============================================================
   HELPERS
   ============================================================ */

function getInventoryFromPath(pathname) {
  const match = INVENTORIES.find((inventory) =>
    pathname.includes(`/inventory/${inventory.key}`)
  );

  return match?.key || "finished-products";
}

function formatQuantity(quantity, unit) {
  if (quantity === undefined || quantity === null) {
    return "—";
  }

  return `${Number(quantity).toLocaleString("en-US")} ${unit || ""}`.trim();
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function Inventory() {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  const activeInventory = getInventoryFromPath(
    location.pathname
  );

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);

  const [modal, setModal] = useState({
    open: false,
    type: "confirm",
    title: "",
    message: "",
  });

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  /* ==========================================================
     LOAD PRODUCTS

     Backend integration will be added when the inventory/product
     models are created.

     Keeping the loader here means we don't have to restructure
     the component later.
     ========================================================== */

  useEffect(() => {
    let cancelled = false;

    const loadProducts = async () => {
      try {
        setLoading(true);

        /*
         * TODO:
         *
         * const data = await getProducts({
         *   inventory: activeInventory,
         *   search,
         *   page,
         *   limit: PAGE_SIZE,
         * });
         *
         * if (!cancelled) {
         *   setProducts(data.products);
         * }
         */

        if (!cancelled) {
          setProducts([]);
        }
      } catch (error) {
        console.error(
          "Failed to load inventory products:",
          error
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, [activeInventory, page, search]);

  /* ==========================================================
     INVENTORY NAVIGATION
     ========================================================== */

  const goToInventory = (inventoryKey) => {
    navigate(`/inventory/${inventoryKey}`);
    setPage(1);
    setSearch("");
  };

  /* ==========================================================
     PRODUCT ACTIONS
     ========================================================== */

  const handleCreate = () => {
    /*
     * Later:
     *
     * navigate(
     *   `/inventory/${activeInventory}/products/new`
     * );
     */
    console.log(
      "Create product in:",
      activeInventory
    );
  };

  const handleEdit = (product) => {
    /*
     * Later:
     *
     * navigate(
     *   `/inventory/${activeInventory}/products/${product._id}/edit`
     * );
     */
    console.log("Edit product:", product);
  };

  const askDelete = (product) => {
    setDeleteTarget(product);

    setModal({
      open: true,
      type: "confirm",
      title: t("inventory.products.deleteTitle"),
      message: t(
        "inventory.products.deleteMessage"
      ),
    });
  };

  const closeModal = () => {
    if (deleteLoading) return;

    setModal((prev) => ({
      ...prev,
      open: false,
    }));

    setDeleteTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleteLoading(true);

      /*
       * Later:
       *
       * await deleteProduct(deleteTarget._id);
       */

      setProducts((prev) =>
        prev.filter(
          (product) =>
            product._id !== deleteTarget._id
        )
      );

      setModal({
        open: true,
        type: "success",
        title: t(
          "inventory.products.deleteSuccessTitle"
        ),
        message: t(
          "inventory.products.deleteSuccessMessage"
        ),
      });

      setDeleteTarget(null);
    } catch (error) {
      console.error(
        "Failed to delete product:",
        error
      );

      setModal({
        open: true,
        type: "error",
        title: t("common.fail"),
        message:
          error.response?.data?.message ||
          t(
            "inventory.products.deleteFailedMessage"
          ),
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  /* ==========================================================
     CURRENT INVENTORY
     ========================================================== */

  const currentInventory =
    INVENTORIES.find(
      (inventory) =>
        inventory.key === activeInventory
    ) || INVENTORIES[0];

  const CurrentIcon = currentInventory.icon;

  /* ==========================================================
     BREADCRUMBS
     ========================================================== */

  const breadcrumbItems = [
    {
      label: t("inventory.title"),
    },
    {
      label: t(
        `inventory.types.${activeInventory}`
      ),
    },
  ];

  /* ==========================================================
     EMPTY STATE
     ========================================================== */

  const isEmpty =
    !loading && products.length === 0;

  return (
    <div className="pageShell">
      <Breadcrumbs items={breadcrumbItems} />

      {/* ======================================================
          HEADER
          ====================================================== */}

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <Package size={26} />

            <h1>
              {t("inventory.title")}
            </h1>
          </div>

          <p>
            {t("inventory.subtitle")}
          </p>
        </div>

        {!isEmpty && (
          <button
            type="button"
            className="btnPrimary"
            onClick={handleCreate}
          >
            <Plus size={18} />

            {t(
              "inventory.products.addProduct"
            )}
          </button>
        )}
      </div>

      {/* ======================================================
          INVENTORY TABS
          ====================================================== */}

      <div className={styles.inventoryTabs}>
        {INVENTORIES.map((inventory) => {
          const Icon = inventory.icon;

          const isActive =
            inventory.key === activeInventory;

          return (
            <button
              key={inventory.key}
              type="button"
              className={`${styles.inventoryTab} ${
                isActive
                  ? styles.inventoryTabActive
                  : ""
              }`}
              onClick={() =>
                goToInventory(
                  inventory.key
                )
              }
            >
              <Icon size={15} />

              {t(
                `inventory.types.${inventory.key}`
              )}
            </button>
          );
        })}
      </div>

      {/* ======================================================
          INVENTORY CONTEXT
          ====================================================== */}

      <div className={styles.inventoryInfo}>
        <div className={styles.inventoryInfoHeader}>
          <CurrentIcon size={18} />

          <div>
            <strong>
              {t(
                `inventory.types.${activeInventory}`
              )}
            </strong>

            <span>
              {t(
                "inventory.products.inventoryDescription"
              )}
            </span>
          </div>
        </div>

        <div className={styles.inventoryStats}>
          <span>
            {products.length}{" "}
            {t(
              "inventory.products.productCount"
            )}
          </span>
        </div>
      </div>

      {/* ======================================================
          TOOLBAR
          ====================================================== */}

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <SearchBar
            placeholder={t(
              "inventory.products.searchPlaceholder"
            )}
            onSearch={(value) => {
              setSearch(value);
              setPage(1);
            }}
            onClear={() => {
              setSearch("");
              setPage(1);
            }}
          />
        </div>

        <button
          type="button"
          className="btnPrimary"
          onClick={handleCreate}
        >
          <Plus size={16} />

          {t(
            "inventory.products.addProduct"
          )}
        </button>
      </div>

      {/* ======================================================
          LOADING
          ====================================================== */}

      {loading && (
        <p className={styles.loadingText}>
          {t("common.loading")}
        </p>
      )}

      {/* ======================================================
          EMPTY STATE
          ====================================================== */}

      {isEmpty && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon">
            <CurrentIcon size={28} />
          </div>

          <h2>
            {t(
              "inventory.products.emptyTitle"
            )}
          </h2>

          <p>
            {t(
              "inventory.products.emptyMessage"
            )}
          </p>

          <button
            type="button"
            className="btnPrimary"
            onClick={handleCreate}
          >
            <Plus size={16} />

            {t(
              "inventory.products.addProduct"
            )}
          </button>
        </div>
      )}

      {/* ======================================================
          PRODUCTS
          ====================================================== */}

      {!loading && products.length > 0 && (
        <>
          <div className={styles.productGrid}>
            {products.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                t={t}
                onEdit={handleEdit}
                onDelete={askDelete}
              />
            ))}
          </div>

          <Pagination
            page={page}
            pages={Math.ceil(
              products.length / PAGE_SIZE
            )}
            total={products.length}
            limit={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      {/* ======================================================
          DELETE MODAL
          ====================================================== */}

      <ActionModal
        isOpen={modal.open}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        loading={deleteLoading}
        onConfirm={
          modal.type === "confirm"
            ? handleDelete
            : undefined
        }
        onClose={closeModal}
      />
    </div>
  );
}

/* ============================================================
   PRODUCT CARD
   ============================================================ */

function ProductCard({
  product,
  t,
  onEdit,
  onDelete,
}) {
  const status =
    product.status || "active";

  const statusLabel =
    t(
      `inventory.products.status.${status}`
    );

  return (
    <div className={styles.productCard}>
      {/* --------------------------------------------------------
         HEADER
         -------------------------------------------------------- */}

      <div className={styles.productHeader}>
        <div className={styles.productIcon}>
          {product.image?.url ? (
            <img
              src={product.image.url}
              alt=""
            />
          ) : (
            <Package size={22} />
          )}
        </div>

        <div className={styles.productHeading}>
          <h3>
            {product.name || "—"}
          </h3>

          {product.reference && (
            <span>
              {product.reference}
            </span>
          )}
        </div>

        <StatusPill
          status={status}
          label={statusLabel}
        />
      </div>

      {/* --------------------------------------------------------
         DETAILS
         -------------------------------------------------------- */}

      <div className={styles.productDetails}>
        <div>
          <label>
            {t(
              "inventory.products.fields.quantity"
            )}
          </label>

          <strong>
            {formatQuantity(
              product.quantity,
              product.unit
            )}
          </strong>
        </div>

        <div>
          <label>
            {t(
              "inventory.products.fields.category"
            )}
          </label>

          <span>
            {product.category?.name ||
              product.category ||
              "—"}
          </span>
        </div>

        <div>
          <label>
            {t(
              "inventory.products.fields.location"
            )}
          </label>

          <span>
            {product.location || "—"}
          </span>
        </div>

        <div>
          <label>
            {t(
              "inventory.products.fields.minStock"
            )}
          </label>

          <span>
            {formatQuantity(
              product.minimumStock,
              product.unit
            )}
          </span>
        </div>
      </div>

      {/* --------------------------------------------------------
         ACTIONS
         -------------------------------------------------------- */}

      <div className={styles.productFooter}>
        <button
          type="button"
          className="tableActionBtn"
          onClick={() =>
            onEdit(product)
          }
          title={t(
            "inventory.products.actions.edit"
          )}
        >
          <Edit size={15} />
        </button>

        <button
          type="button"
          className="tableActionBtn tableActionBtnDanger"
          onClick={() =>
            onDelete(product)
          }
          title={t(
            "inventory.products.actions.delete"
          )}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}