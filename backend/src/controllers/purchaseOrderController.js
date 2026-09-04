const PurchaseOrder = require('../models/PurchaseOrder');
const { Article } = require('../models/Inventory');
const Supplier = require('../models/Supplier');
const Notification = require('../models/Notification');

// Generate unique PO number
const generatePONumber = async (companyId) => {
  const count = await PurchaseOrder.countDocuments({ company: companyId });
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `PO-${year}${month}-${String(count + 1).padStart(5, '0')}`;
};

// Get all purchase orders
exports.getAllPurchaseOrders = async (req, res) => {
  try {
    const { status, supplier, department, startDate, endDate } = req.query;
    const query = { company: req.company._id };
    
    if (status) query.status = status;
    if (supplier) query.supplier = supplier;
    if (department) query.department = department;
    
    if (startDate || endDate) {
      query.orderDate = {};
      if (startDate) query.orderDate.$gte = new Date(startDate);
      if (endDate) query.orderDate.$lte = new Date(endDate);
    }
    
    const purchaseOrders = await PurchaseOrder.find(query)
      .populate('supplier', 'name email phone')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName')
      .populate('lines.article', 'names internalReference')
      .sort({ orderDate: -1 });
    
    res.json({ purchaseOrders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get PO by ID
exports.getPurchaseOrderById = async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne({
      _id: req.params.id,
      company: req.company._id
    })
      .populate('supplier')
      .populate('createdBy')
      .populate('approvedBy')
      .populate('lines.article');
    
    if (!po) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    
    res.json({ purchaseOrder: po });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create purchase order
exports.createPurchaseOrder = async (req, res) => {
  try {
    const { supplierId, department, lines, expectedDeliveryDate, notes } = req.body;
    
    // Validate supplier
    const supplier = await Supplier.findOne({
      _id: supplierId,
      company: req.company._id
    });
    
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    // Validate and process lines
    const processedLines = [];
    let subtotal = 0;
    
    for (let line of lines) {
      const article = await Article.findOne({
        _id: line.articleId,
        company: req.company._id
      });
      
      if (!article) {
        return res.status(404).json({ error: `Article ${line.articleId} not found` });
      }
      
      const lineTotal = line.quantity * line.unitPrice;
      subtotal += lineTotal;
      
      processedLines.push({
        article: article._id,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        totalPrice: lineTotal,
        deliveryDate: line.deliveryDate,
        notes: line.notes
      });
    }
    
    // Generate PO number
    const poNumber = await generatePONumber(req.company._id);
    
    const purchaseOrder = new PurchaseOrder({
      company: req.company._id,
      poNumber,
      supplier: supplier._id,
      department,
      createdBy: req.user.id,
      lines: processedLines,
      expectedDeliveryDate,
      subtotal,
      totalAmount: subtotal,
      notes,
      status: 'draft'
    });
    
    purchaseOrder.addHistory('created', req.user.id, 'Purchase order created');
    await purchaseOrder.save();
    
    // Create notification for managers
    await Notification.create({
      company: req.company._id,
      targetRole: 'manager',
      targetDepartment: department,
      type: 'purchase_order_created',
      title: `New Purchase Order: ${poNumber}`,
      message: `A new purchase order has been created for ${supplier.name}`,
      icon: 'document',
      relatedResource: {
        resourceType: 'purchase_order',
        resourceId: purchaseOrder._id
      },
      actionUrl: `/purchase-orders/${purchaseOrder._id}`,
      priority: 'normal'
    });
    
    res.status(201).json({
      message: 'Purchase order created successfully',
      purchaseOrder: await purchaseOrder.populate(['supplier', 'createdBy', 'lines.article'])
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update purchase order
exports.updatePurchaseOrder = async (req, res) => {
  try {
    const { department, lines, expectedDeliveryDate, notes } = req.body;
    
    const po = await PurchaseOrder.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!po) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    
    if (po.status !== 'draft' && po.status !== 'pending') {
      return res.status(400).json({ error: 'Can only edit draft or pending orders' });
    }
    
    // Process new lines if provided
    if (lines) {
      const processedLines = [];
      let subtotal = 0;
      
      for (let line of lines) {
        const article = await Article.findOne({
          _id: line.articleId || line.article,
          company: req.company._id
        });
        
        if (!article) {
          return res.status(404).json({ error: 'Article not found' });
        }
        
        const lineTotal = line.quantity * line.unitPrice;
        subtotal += lineTotal;
        
        processedLines.push({
          article: article._id,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          totalPrice: lineTotal,
          deliveryDate: line.deliveryDate,
          notes: line.notes
        });
      }
      
      po.lines = processedLines;
      po.subtotal = subtotal;
      po.totalAmount = subtotal + (po.tax || 0) + (po.shippingCost || 0);
    }
    
    Object.assign(po, { department, expectedDeliveryDate, notes });
    po.addHistory('updated', req.user.id, 'Purchase order updated');
    
    await po.save();
    await po.populate(['supplier', 'createdBy', 'lines.article']);
    
    res.json({ message: 'Purchase order updated successfully', purchaseOrder: po });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Send purchase order
exports.sendPurchaseOrder = async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne({
      _id: req.params.id,
      company: req.company._id
    }).populate('supplier');
    
    if (!po) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    
    if (po.status !== 'draft' && po.status !== 'pending') {
      return res.status(400).json({ error: 'Only draft or pending orders can be sent' });
    }
    
    po.status = 'sent';
    po.addHistory('sent', req.user.id, 'Purchase order sent to supplier');
    await po.save();
    
    // Notify about sent PO
    await Notification.create({
      company: req.company._id,
      targetRole: 'manager',
      type: 'purchase_order_created',
      title: `PO Sent: ${po.poNumber}`,
      message: `Purchase order has been sent to ${po.supplier.name}`,
      icon: 'send',
      relatedResource: {
        resourceType: 'purchase_order',
        resourceId: po._id
      }
    });
    
    res.json({ message: 'Purchase order sent successfully', purchaseOrder: po });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Approve purchase order
exports.approvePurchaseOrder = async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!po) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    
    if (po.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending orders can be approved' });
    }
    
    po.status = 'approved';
    po.approvedBy = req.user.id;
    po.addHistory('approved', req.user.id, 'Purchase order approved');
    await po.save();
    
    // Notify
    await Notification.create({
      company: req.company._id,
      targetRole: 'supervisor',
      type: 'purchase_order_approved',
      title: `PO Approved: ${po.poNumber}`,
      message: 'A purchase order has been approved',
      icon: 'check',
      priority: 'high'
    });
    
    res.json({ message: 'Purchase order approved successfully', purchaseOrder: po });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Receive purchase order
exports.receivePurchaseOrder = async (req, res) => {
  try {
    const { receivedLines } = req.body;
    const po = await PurchaseOrder.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!po) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    
    // Update received quantities
    for (let receivedLine of receivedLines) {
      const line = po.lines.id(receivedLine.lineId);
      if (line) {
        line.receivedQuantity = receivedLine.quantity;
        
        // Update article stock
        const article = await Article.findById(line.article);
        if (article) {
          article.quantity += receivedLine.quantity;
          await article.save();
        }
      }
    }
    
    po.status = 'received';
    po.actualDeliveryDate = new Date();
    po.addHistory('received', req.user.id, 'Goods received');
    await po.save();
    
    res.json({ message: 'Purchase order marked as received', purchaseOrder: po });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Cancel purchase order
exports.cancelPurchaseOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const po = await PurchaseOrder.findOne({
      _id: req.params.id,
      company: req.company._id
    });
    
    if (!po) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    
    if (['received', 'cancelled'].includes(po.status)) {
      return res.status(400).json({ error: 'This order cannot be cancelled' });
    }
    
    po.status = 'cancelled';
    po.addHistory('cancelled', req.user.id, `Cancelled: ${reason}`);
    await po.save();
    
    res.json({ message: 'Purchase order cancelled successfully', purchaseOrder: po });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get PO statistics
exports.getPurchaseOrderStats = async (req, res) => {
  try {
    const stats = {
      draft: await PurchaseOrder.countDocuments({ company: req.company._id, status: 'draft' }),
      pending: await PurchaseOrder.countDocuments({ company: req.company._id, status: 'pending' }),
      approved: await PurchaseOrder.countDocuments({ company: req.company._id, status: 'approved' }),
      sent: await PurchaseOrder.countDocuments({ company: req.company._id, status: 'sent' }),
      received: await PurchaseOrder.countDocuments({ company: req.company._id, status: 'received' }),
      cancelled: await PurchaseOrder.countDocuments({ company: req.company._id, status: 'cancelled' })
    };
    
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = exports;
