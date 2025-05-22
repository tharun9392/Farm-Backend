/**
 * Request validation middleware
 * @param {Object} schema - Joi validation schema
 * @param {String} property - Request property to validate (body, query, params)
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (!error) {
      return next();
    }

    const errors = {};
    error.details.forEach((detail) => {
      const key = detail.path[0];
      errors[key] = detail.message;
    });

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  };
};

module.exports = validate; 