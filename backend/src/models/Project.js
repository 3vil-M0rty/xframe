const mongoose = require('mongoose');

const projectConsumptionSchema = new mongoose.Schema({
  article: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  unit: String,
  date: {
    type: Date,
    default: Date.now
  },
  notes: String
});

const projectSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  projectCode: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['planning', 'in-progress', 'completed', 'paused', 'cancelled'],
    default: 'planning'
  },
  startDate: Date,
  endDate: Date,
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  budget: Number,
  consumption: [projectConsumptionSchema],
  totalConsumptionValue: {
    type: Number,
    default: 0
  },
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

projectSchema.index({ company: 1, projectCode: 1 });

// Calculate total consumption value
projectSchema.methods.calculateTotalValue = async function() {
  const Article = mongoose.model('Article');
  let total = 0;
  
  for (let item of this.consumption) {
    const article = await Article.findById(item.article);
    if (article) {
      total += article.unitPrice * item.quantity;
    }
  }
  
  this.totalConsumptionValue = total;
  return total;
};

module.exports = mongoose.model('Project', projectSchema);
