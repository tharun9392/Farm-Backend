const Joi = require('joi');

// Validation schema for product creation
const productCreateSchema = Joi.object({
  name: Joi.string().min(3).max(100).required()
    .messages({
      'string.empty': 'Product name is required',
      'string.min': 'Product name must be at least 3 characters',
      'string.max': 'Product name cannot exceed 100 characters'
    }),
  
  description: Joi.string().min(10).max(1000).required()
    .messages({
      'string.empty': 'Product description is required',
      'string.min': 'Description must be at least 10 characters',
      'string.max': 'Description cannot exceed 1000 characters'
    }),
  
  category: Joi.string().valid('basmati', 'brown', 'jasmine', 'sona_masoori', 'ponni', 'other').required()
    .messages({
      'string.empty': 'Category is required',
      'any.only': 'Category must be valid rice variety'
    }),
  
  riceType: Joi.string().valid('basmati', 'brown', 'jasmine', 'sona_masoori', 'ponni', 'other').required()
    .messages({
      'string.empty': 'Rice type is required',
      'any.only': 'Rice type must be valid rice variety'
    }),
  
  price: Joi.number().min(0).required().allow('', null)
    .default(0)
    .messages({
      'number.base': 'Price must be a number',
      'number.min': 'Price must be greater than or equal to 0',
      'number.required': 'Price is required'
    }),
  
  farmerPrice: Joi.number().min(0).required().allow('', null)
    .default(0)
    .messages({
      'number.base': 'Farmer price must be a number',
      'number.min': 'Farmer price must be greater than or equal to 0',
      'number.required': 'Farmer price is required'
    }),
  
  availableQuantity: Joi.number().min(0).default(0).allow('', null)
    .messages({
      'number.base': 'Available quantity must be a number',
      'number.min': 'Available quantity must be at least 0'
    }),
  
  stockQuantity: Joi.number().min(0).required().default(0).allow('', null)
    .messages({
      'number.base': 'Stock quantity must be a number',
      'number.min': 'Stock quantity must be at least at least 0',
      'number.required': 'Stock quantity is required'
    }),
  
  unit: Joi.string().valid('kg', 'g', 'lb', 'ton').default('kg')
    .messages({
      'any.only': 'Unit must be kg, g, lb, or ton'
    }),
  
  images: Joi.array().items(Joi.string()).optional().default([])
    .messages({
      'array.base': 'Images must be an array'
    }),
  
  organicCertified: Joi.boolean().default(false),
  
  harvestedDate: Joi.date().max('now').allow(null, '').optional()
    .messages({
      'date.max': 'Harvest date cannot be in the future'
    }),
  
  // Make the entire qualityParameters object optional
  qualityParameters: Joi.object({
    moisture: Joi.number().min(0).max(100).allow(null, '').optional(),
    brokenGrains: Joi.number().min(0).max(100).allow(null, '').optional(),
    foreignMatter: Joi.number().min(0).max(100).allow(null, '').optional(),
    aroma: Joi.string().valid('strong', 'medium', 'mild', 'none').allow(null, '').optional(),
    color: Joi.string().allow(null, '').optional(),
    grainLength: Joi.number().min(0).allow(null, '').optional()
  }).optional().allow(null),
  
  certifications: Joi.array().items(Joi.string()).optional().default([]),
  
  // Additional fields for paddy submission
  isProcessedRice: Joi.boolean().optional(),
  status: Joi.string().valid('pending', 'approved', 'rejected').optional(),
  region: Joi.string().optional()
});

// Validation schema for product update
const productUpdateSchema = Joi.object({
  name: Joi.string().min(3).max(100)
    .messages({
      'string.min': 'Product name must be at least 3 characters',
      'string.max': 'Product name cannot exceed 100 characters'
    }),
  
  description: Joi.string().min(10).max(1000)
    .messages({
      'string.min': 'Description must be at least 10 characters',
      'string.max': 'Description cannot exceed 1000 characters'
    }),
  
  category: Joi.string().valid('basmati', 'brown', 'jasmine', 'sona_masoori', 'ponni', 'other')
    .messages({
      'any.only': 'Category must be valid rice variety'
    }),
  
  price: Joi.number().positive()
    .messages({
      'number.base': 'Price must be a number',
      'number.positive': 'Price must be greater than 0'
    }),
  
  availableQuantity: Joi.number().min(0).integer()
    .messages({
      'number.base': 'Available quantity must be a number',
      'number.min': 'Available quantity must be at least 0',
      'number.integer': 'Available quantity must be a whole number'
    }),
  
  unit: Joi.string().valid('kg', 'g', 'lb', 'ton')
    .messages({
      'any.only': 'Unit must be kg, g, lb, or ton'
    }),
  
  images: Joi.array().items(Joi.string().uri())
    .messages({
      'array.base': 'Images must be an array',
      'string.uri': 'Image URL must be valid'
    }),
  
  organicCertified: Joi.boolean(),
  
  harvestedDate: Joi.date().max('now').allow(null).optional()
    .messages({
      'date.max': 'Harvest date cannot be in the future'
    }),
  
  // Make the entire qualityParameters object optional
  qualityParameters: Joi.object({
    moisture: Joi.number().min(0).max(100).allow(null, '').optional(),
    brokenGrains: Joi.number().min(0).max(100).allow(null, '').optional(),
    foreignMatter: Joi.number().min(0).max(100).allow(null, '').optional(),
    aroma: Joi.string().valid('strong', 'medium', 'mild', 'none').allow(null, '').optional(),
    color: Joi.string().allow(null, '').optional(),
    grainLength: Joi.number().min(0).allow(null, '').optional()
  }).optional().allow(null),
  
  certifications: Joi.array().items(Joi.string()).optional(),
  
  // Additional fields for admin/staff product creation
  isProcessedRice: Joi.boolean().optional(),
  status: Joi.string().valid('pending', 'approved', 'rejected').optional(),
  farmer: Joi.string().optional(),
  farmerPrice: Joi.number().min(0).allow('', null).optional()
});

// Middleware to validate product creation request
const validateProductCreation = (req, res, next) => {
  console.log('Validating product creation request:', req.body);
  
  const { error } = productCreateSchema.validate(req.body, { 
    abortEarly: false,
    stripUnknown: false 
  });
  
  if (error) {
    const errorMessage = error.details.map(detail => detail.message).join(', ');
    console.log('Product validation failed:', errorMessage);
    return res.status(400).json({ message: errorMessage });
  }
  
  console.log('Product validation passed');
  next();
};

// Middleware to validate product update request
const validateProductUpdate = (req, res, next) => {
  const { error } = productUpdateSchema.validate(req.body, { 
    abortEarly: false,
    stripUnknown: false 
  });
  
  if (error) {
    const errorMessage = error.details.map(detail => detail.message).join(', ');
    return res.status(400).json({ message: errorMessage });
  }
  
  next();
};

module.exports = {
  validateProductCreation,
  validateProductUpdate
}; 