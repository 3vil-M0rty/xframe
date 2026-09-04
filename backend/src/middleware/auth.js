const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Permission = require('../models/Permission');

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const checkCompanyAccess = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate('company');
    
    if (!user || !user.company) {
      return res.status(403).json({ error: 'Company access denied' });
    }
    
    // Add company to request
    req.company = user.company;
    req.userRole = user.role;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

const checkPermission = (resource, action) => {
  return async (req, res, next) => {
    try {
      // Admins have all permissions
      if (req.userRole === 'admin') {
        return next();
      }
      
      const permission = await Permission.findOne({
        user: req.user.id,
        company: req.company._id,
        resource,
        actions: action
      });
      
      if (!permission) {
        return res.status(403).json({ error: `Permission denied for ${resource}:${action}` });
      }
      
      req.permission = permission;
      next();
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  };
};

const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({ error: 'Insufficient role privileges' });
    }
    next();
  };
};

module.exports = {
  authenticate,
  checkCompanyAccess,
  checkPermission,
  checkRole
};
