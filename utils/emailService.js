const path = require('path');
const fs = require('fs');
const handlebars = require('handlebars');
const sgMail = require('@sendgrid/mail');
const logger = require('./logger');

// Initialize SendGrid if API key is available
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  logger.info('SendGrid API initialized');
} else {
  logger.warn('SendGrid API key not found. Email functionality will be limited.');
}

// Default template directory - change this based on your folder structure
const templateDir = path.join(__dirname, '../templates/emails');

// Ensure template directory exists
try {
  if (!fs.existsSync(templateDir)) {
    // Create the directory if it doesn't exist
    fs.mkdirSync(templateDir, { recursive: true });
    console.log(`Created template directory at ${templateDir}`);
  }
} catch (error) {
  console.error(`Error creating template directory: ${error.message}`);
}

/**
 * Helper function to load template from file system
 * @param {string} templateName - Name of the template file without extension
 * @returns {function} Compiled handlebars template
 */
const loadTemplate = (templateName) => {
  try {
    const templatePath = path.join(templateDir, `${templateName}.html`);
    let templateSource;
    
    if (fs.existsSync(templatePath)) {
      templateSource = fs.readFileSync(templatePath, 'utf-8');
    } else {
      // Use a default template if the specific one doesn't exist
      console.log(`Template ${templateName} not found, using default template`);
      templateSource = getDefaultTemplate(templateName);
    }
    
    return handlebars.compile(templateSource);
  } catch (error) {
    console.error(`Error loading template ${templateName}:`, error);
    // Return a simple fallback template
    return handlebars.compile('<h1>{{subject}}</h1><p>{{message}}</p>');
  }
};

/**
 * Returns a default template based on the template name
 * @param {string} templateName - Name of the template 
 * @returns {string} Default HTML template
 */
const getDefaultTemplate = (templateName) => {
  switch (templateName) {
    case 'orderConfirmation':
      return `
        <h1>Order Confirmation</h1>
        <p>Dear {{name}},</p>
        <p>Thank you for your order #{{orderNumber}}.</p>
        <p>Total: {{totalPrice}}</p>
        <p>We will notify you when your order ships.</p>
      `;
    case 'paymentConfirmation':
      return `
        <h1>Payment Confirmation</h1>
        <p>Dear {{name}},</p>
        <p>Your payment of {{amount}} has been processed successfully.</p>
        <p>Transaction ID: {{transactionId}}</p>
      `;
    case 'orderStatusUpdate':
      return `
        <h1>Order Status Update</h1>
        <p>Dear {{name}},</p>
        <p>Your order #{{orderNumber}} has been updated to: {{newStatus}}</p>
        <p>{{statusMessage}}</p>
        <p>{{nextSteps}}</p>
      `;
    case 'passwordReset':
      return `
        <h1>Password Reset</h1>
        <p>You requested a password reset. Please click the link below:</p>
        <p><a href="{{resetUrl}}">Reset Password</a></p>
        <p>This link will expire in {{expiryTime}}.</p>
      `;
    case 'lowStockAlert':
      return `
        <h1>Low Stock Alert</h1>
        <p>{{count}} products require attention.</p>
        <p>Please check your inventory dashboard.</p>
      `;
    case 'farmerPayment':
      return `
        <h1>Payment Confirmation</h1>
        <p>Dear {{name}},</p>
        <p>We've processed a payment of {{amount}} for your rice supply.</p>
        <p>Thank you for your partnership!</p>
      `;
    case 'announcement':
      return `
        <h1>{{title}}</h1>
        <p>{{content}}</p>
        <p>From: {{senderName}}, {{senderRole}}</p>
        <p>Date: {{date}}</p>
      `;
    case 'passwordResetOTP':
      return `
        <h1>Password Reset OTP</h1>
        <p>Dear {{name}},</p>
        <p>You requested a password reset. Your OTP is:</p>
        <div style="margin: 20px 0; padding: 10px; background-color: #f7f7f7; border-radius: 5px; text-align: center; font-size: 24px; letter-spacing: 5px;">
          <strong>{{otp}}</strong>
        </div>
        <p>This OTP will expire in {{expiryTime}} minutes. If you did not request this reset, please ignore this email.</p>
        <p>Thank you,<br>The Farmer Rice Team</p>
      `;
    default:
      return `<h1>{{subject}}</h1><p>{{message}}</p>`;
  }
};

/**
 * Send email using SendGrid
 * @param {Object} options - Email options
 * @returns {Promise} - SendGrid response
 */
const sendEmail = async (options) => {
  console.log('Attempting to send email:', {
    to: options.to,
    subject: options.subject,
    sgMailInitialized: !!sgMail
  });
  
  if (!sgMail) {
    console.log('SendGrid not initialized. Email would have been sent with:', {
      to: options.to,
      subject: options.subject,
      htmlLength: options.html ? options.html.length : 0
    });
    
    // For testing purposes, output the full HTML content to console
    if (process.env.NODE_ENV === 'development') {
      console.log('Email HTML content (truncated):', 
        options.html ? options.html.substring(0, 500) + '...' : 'No HTML content');
    }
    
    return { 
      id: 'mock-email-id', 
      successful: false, 
      mockMode: true,
      reason: 'SendGrid not initialized' 
    };
  }

  try {
    const msg = {
      to: options.to,
      from: options.from || process.env.EMAIL_FROM || 'no-reply@farmerrice.com',
      subject: options.subject,
      html: options.html,
      text: options.text || 'Please view this email in a modern email client that supports HTML.',
    };

    // Add CC if provided
    if (options.cc) msg.cc = options.cc;
    
    // Add BCC if provided
    if (options.bcc) msg.bcc = options.bcc;

    console.log('Sending email with SendGrid:', {
      to: msg.to,
      from: msg.from,
      subject: msg.subject
    });

    // Send the email
    const response = await sgMail.send(msg);
    console.log('Email sent successfully to:', msg.to);
    return response;
  } catch (error) {
    console.error('Email sending failed:', error);
    if (error.response) {
      console.error('Error details:', error.response.body);
    }
    
    // Return a failed result rather than throwing
    return { 
      id: 'error-email-id', 
      successful: false, 
      error: error.message
    };
  }
};

/**
 * Send order confirmation email
 * @param {Object} user - User object
 * @param {Object} order - Order object
 * @returns {Promise} - SendGrid response
 */
const sendOrderConfirmation = async (user, order) => {
  try {
    // Load the template
    const template = loadTemplate('orderConfirmation');
    
    // Format order details for template
    const itemsHtml = order.items.map(item => 
      `<tr>
        <td>${item.name}</td>
        <td>${item.quantity}</td>
        <td>₹${item.price.toFixed(2)}</td>
        <td>₹${(item.price * item.quantity).toFixed(2)}</td>
      </tr>`
    ).join('');
    
    // Compile template with data
    const html = template({
      name: user.name,
      orderNumber: order.orderNumber,
      orderDate: new Date(order.createdAt).toLocaleDateString(),
      items: itemsHtml,
      itemsPrice: `₹${order.itemsPrice.toFixed(2)}`,
      taxPrice: `₹${order.taxPrice.toFixed(2)}`,
      shippingPrice: `₹${order.shippingPrice.toFixed(2)}`,
      totalPrice: `₹${order.totalPrice.toFixed(2)}`,
      shippingAddress: `${order.shippingAddress.street}, ${order.shippingAddress.city}, ${order.shippingAddress.state}, ${order.shippingAddress.postalCode}, ${order.shippingAddress.country}`,
      paymentMethod: order.paymentMethod,
      trackingUrl: order.trackingNumber ? `https://example.com/track/${order.trackingNumber}` : '#',
      supportEmail: 'support@farmerrice.com',
      websiteUrl: process.env.FRONTEND_URL || 'https://farmerrice.com',
      year: new Date().getFullYear()
    });
    
    // Send the email
    return await sendEmail({
      to: user.email,
      subject: `Order Confirmation #${order.orderNumber}`,
      html
    });
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
    // Return a mock response instead of throwing to prevent app crashes
    return { id: 'mock-email-id', successful: false, reason: error.message };
  }
};

/**
 * Send order status update email
 * @param {Object} user - User object
 * @param {Object} order - Order object
 * @param {string} previousStatus - Previous order status
 * @param {string} newStatus - New order status
 * @returns {Promise} - SendGrid response
 */
const sendOrderStatusUpdate = async (user, order, previousStatus, newStatus) => {
  try {
    // Load the template
    const template = loadTemplate('orderStatusUpdate');
    
    // Status-specific messaging
    let statusMessage = '';
    let nextSteps = '';
    
    switch (newStatus) {
      case 'Processing':
        statusMessage = 'Your order has been confirmed and is being processed.';
        nextSteps = 'We will notify you once your order has been packed and is ready for shipping.';
        break;
      case 'Packed':
        statusMessage = 'Your order has been packed and is ready for shipping.';
        nextSteps = 'Your order will be handed over to our shipping partner soon.';
        break;
      case 'Shipped':
        statusMessage = `Your order has been shipped${order.trackingNumber ? ` with tracking number ${order.trackingNumber}` : ''}.`;
        nextSteps = 'You can track your order using the tracking information provided.';
        break;
      case 'Delivered':
        statusMessage = 'Your order has been delivered successfully.';
        nextSteps = 'We hope you enjoy your purchase! Please consider leaving a review.';
        break;
      case 'Cancelled':
        statusMessage = 'Your order has been cancelled.';
        nextSteps = 'If you did not request this cancellation, please contact our support team.';
        break;
      default:
        statusMessage = `Your order status has been updated to ${newStatus}.`;
        nextSteps = 'Please check your account for more information.';
    }
    
    // Compile template with data
    const html = template({
      name: user.name,
      orderNumber: order.orderNumber,
      previousStatus,
      newStatus,
      statusMessage,
      nextSteps,
      orderUrl: `${process.env.FRONTEND_URL || 'https://farmerrice.com'}/customer/orders/${order._id}`,
      trackingUrl: order.trackingNumber ? `https://example.com/track/${order.trackingNumber}` : null,
      trackingNumber: order.trackingNumber,
      supportEmail: 'support@farmerrice.com',
      websiteUrl: process.env.FRONTEND_URL || 'https://farmerrice.com',
      year: new Date().getFullYear()
    });
    
    // Send the email
    return await sendEmail({
      to: user.email,
      subject: `Order Status Update: ${newStatus} - #${order.orderNumber}`,
      html
    });
  } catch (error) {
    console.error('Error sending order status update email:', error);
    // Return a mock response instead of throwing to prevent app crashes
    return { id: 'mock-email-id', successful: false, reason: error.message };
  }
};

/**
 * Send payment confirmation email
 * @param {Object} user - User object
 * @param {Object} payment - Payment object
 * @param {Object} order - Order object
 * @returns {Promise} - SendGrid response
 */
const sendPaymentConfirmation = async (user, payment, order) => {
  try {
    // Load the template
    const template = loadTemplate('paymentConfirmation');
    
    // Prepare invoice data
    const invoiceUrl = payment.invoice && payment.invoice.pdfUrl 
      ? `${process.env.FRONTEND_URL || 'https://farmerrice.com'}${payment.invoice.pdfUrl}`
      : null;
    
    // Compile template with data
    const html = template({
      name: user.name,
      orderNumber: order ? order.orderNumber : 'N/A',
      paymentDate: new Date(payment.paymentDate || payment.createdAt).toLocaleDateString(),
      paymentId: payment._id,
      transactionId: payment.transactionId,
      amount: `₹${payment.amount.toFixed(2)}`,
      paymentMethod: payment.paymentGateway,
      status: payment.status === 'completed' ? 'Successful' : payment.status,
      invoiceUrl,
      orderUrl: order ? `${process.env.FRONTEND_URL || 'https://farmerrice.com'}/customer/orders/${order._id}` : null,
      supportEmail: 'support@farmerrice.com',
      websiteUrl: process.env.FRONTEND_URL || 'https://farmerrice.com',
      year: new Date().getFullYear()
    });
    
    // Send the email
    return await sendEmail({
      to: user.email,
      subject: `Payment ${payment.status === 'completed' ? 'Confirmation' : 'Update'} - ₹${payment.amount.toFixed(2)}`,
      html
    });
  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
    // Return a mock response instead of throwing to prevent app crashes
    return { id: 'mock-email-id', successful: false, reason: error.message };
  }
};

/**
 * Send password reset email
 * @param {string} email - User email
 * @param {string} resetToken - Password reset token
 * @returns {Promise} - SendGrid response
 */
const sendPasswordReset = async (email, resetToken) => {
  try {
    // Load the template
    const template = loadTemplate('passwordReset');
    
    // Reset URL
    const resetUrl = `${process.env.FRONTEND_URL || 'https://farmerrice.com'}/reset-password/${resetToken}`;
    
    // Compile template with data
    const html = template({
      resetUrl,
      expiryTime: '1 hour', // This should match your token expiry time
      supportEmail: 'support@farmerrice.com',
      websiteUrl: process.env.FRONTEND_URL || 'https://farmerrice.com',
      year: new Date().getFullYear()
    });
    
    // Send the email
    return await sendEmail({
      to: email,
      subject: 'Password Reset Request',
      html
    });
  } catch (error) {
    console.error('Error sending password reset email:', error);
    // Return a mock response instead of throwing to prevent app crashes
    return { id: 'mock-email-id', successful: false, reason: error.message };
  }
};

/**
 * Send low stock alert to admin
 * @param {Array} products - Array of low stock products
 * @param {Array} adminEmails - Array of admin email addresses
 * @returns {Promise} - SendGrid response
 */
const sendLowStockAlert = async (products, adminEmails) => {
  try {
    // Load the template
    const template = loadTemplate('lowStockAlert');
    
    // Format products for template
    const productsHtml = products.map(product => 
      `<tr>
        <td>${product.name}</td>
        <td>${product.stockQuantity}</td>
        <td>${product.threshold}</td>
        <td>${product.farmer.name}</td>
      </tr>`
    ).join('');
    
    // Compile template with data
    const html = template({
      products: productsHtml,
      count: products.length,
      dashboardUrl: `${process.env.FRONTEND_URL || 'https://farmerrice.com'}/admin/inventory`,
      date: new Date().toLocaleDateString(),
      supportEmail: 'support@farmerrice.com',
      websiteUrl: process.env.FRONTEND_URL || 'https://farmerrice.com',
      year: new Date().getFullYear()
    });
    
    // Send the email
    return await sendEmail({
      to: adminEmails,
      subject: `Low Stock Alert: ${products.length} Products Require Attention`,
      html
    });
  } catch (error) {
    console.error('Error sending low stock alert email:', error);
    // Return a mock response instead of throwing to prevent app crashes
    return { id: 'mock-email-id', successful: false, reason: error.message };
  }
};

/**
 * Send farmer payment notification
 * @param {Object} farmer - Farmer user object
 * @param {Object} payment - Payment object
 * @returns {Promise} - SendGrid response
 */
const sendFarmerPayment = async (farmer, payment) => {
  try {
    // Load the template
    const template = loadTemplate('farmerPayment');
    
    // Compile template with data
    const html = template({
      name: farmer.name,
      amount: `₹${payment.amount.toFixed(2)}`,
      paymentDate: new Date(payment.paymentDate || payment.createdAt).toLocaleDateString(),
      paymentId: payment._id,
      paymentMethod: payment.paymentMethod,
      description: payment.description,
      riceQuantity: payment.farmerPaymentDetails?.riceQuantity || 'N/A',
      ratePerKg: payment.farmerPaymentDetails?.ratePerKg ? `₹${payment.farmerPaymentDetails.ratePerKg.toFixed(2)}` : 'N/A',
      bankDetails: payment.farmerPaymentDetails?.bankDetails || 'Not provided',
      dashboardUrl: `${process.env.FRONTEND_URL || 'https://farmerrice.com'}/farmer/dashboard`,
      supportEmail: 'support@farmerrice.com',
      websiteUrl: process.env.FRONTEND_URL || 'https://farmerrice.com',
      year: new Date().getFullYear()
    });
    
    // Send the email
    return await sendEmail({
      to: farmer.email,
      subject: `Payment Confirmation: ₹${payment.amount.toFixed(2)}`,
      html
    });
  } catch (error) {
    console.error('Error sending farmer payment email:', error);
    // Return a mock response instead of throwing to prevent app crashes
    return { id: 'mock-email-id', successful: false, reason: error.message };
  }
};

/**
 * Send announcement to users
 * @param {Array} users - Array of user objects
 * @param {Object} announcement - Announcement object
 * @returns {Promise} - SendGrid response
 */
const sendAnnouncement = async (users, announcement) => {
  try {
    // Check if users array is empty
    if (!users || users.length === 0) {
      console.log('No users to send announcement to');
      return { id: 'mock-email-id', successful: false, reason: 'No users provided' };
    }

    // Load the template
    const template = loadTemplate('announcement');
    
    // Compile template with data
    const html = template({
      title: announcement.title,
      content: announcement.content,
      date: new Date().toLocaleDateString(),
      priority: announcement.priority,
      senderName: announcement.sentBy.name,
      senderRole: 'Administrator',
      dashboardUrl: `${process.env.FRONTEND_URL || 'https://farmerrice.com'}/dashboard`,
      supportEmail: 'support@farmerrice.com',
      websiteUrl: process.env.FRONTEND_URL || 'https://farmerrice.com',
      year: new Date().getFullYear()
    });
    
    // Extract email addresses
    const emails = users.map(user => user.email);
    
    // Send the email
    return await sendEmail({
      to: emails,
      subject: `Announcement: ${announcement.title}`,
      html
    });
  } catch (error) {
    console.error('Error sending announcement email:', error);
    // Return a mock response instead of throwing to prevent app crashes
    return { id: 'mock-email-id', successful: false, reason: error.message };
  }
};

/**
 * Send password reset OTP
 * @param {Object} user - User object
 * @param {String} otp - One-time password
 * @param {Number} expiryMinutes - OTP expiry in minutes
 * @returns {Promise} - Email sending result
 */
const sendPasswordResetOTP = async (user, otp, expiryMinutes) => {
  try {
    // If SendGrid API key is not available and we're in development,
    // log the OTP instead of sending an email
    if (!process.env.SENDGRID_API_KEY && process.env.NODE_ENV === 'development') {
      logger.info(`[DEV MODE] Password reset OTP for ${user.email}: ${otp}`);
      logger.info(`This OTP will expire in ${expiryMinutes} minutes`);
      return {
        success: true,
        message: 'Development mode: OTP logged to console'
      };
    }

    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SendGrid API key not configured');
    }

    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'no-reply@farmerrice.com';
    const fromName = process.env.SENDGRID_FROM_NAME || 'Farmer Rice';
    
    const msg = {
      to: user.email,
      from: {
        email: fromEmail,
        name: fromName
      },
      subject: 'Password Reset OTP - Farmer Rice',
      text: `Hello ${user.name},\n\nYour password reset OTP is: ${otp}\n\nThis OTP will expire in ${expiryMinutes} minutes.\n\nIf you did not request a password reset, please ignore this email.\n\nThank you,\nThe Farmer Rice Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #4CAF50; padding: 20px; text-align: center; color: white;">
            <h1>Farmer Rice</h1>
          </div>
          <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
            <p>Hello ${user.name},</p>
            <p>You have requested to reset your password. Please use the following One-Time Password (OTP) to complete the process:</p>
            <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0;">
              <strong>${otp}</strong>
            </div>
            <p>This OTP will expire in <strong>${expiryMinutes} minutes</strong>.</p>
            <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
            <p>Thank you,<br>The Farmer Rice Team</p>
          </div>
          <div style="text-align: center; padding: 10px; font-size: 12px; color: #777;">
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      `
    };

    const result = await sgMail.send(msg);
    logger.info(`Password reset OTP email sent to ${user.email}`);
    return {
      success: true,
      message: 'Password reset OTP email sent successfully'
    };
  } catch (error) {
    logger.error(`Failed to send password reset OTP email: ${error.message}`);
    throw error;
  }
};

/**
 * Send password reset confirmation email
 * @param {Object} user - User object
 * @returns {Promise} - Email sending result
 */
const sendPasswordResetConfirmation = async (user) => {
  try {
    if (!process.env.SENDGRID_API_KEY && process.env.NODE_ENV === 'development') {
      logger.info(`[DEV MODE] Password reset confirmation for ${user.email}`);
      return {
        success: true,
        message: 'Development mode: Confirmation logged to console'
      };
    }

    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SendGrid API key not configured');
    }

    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'no-reply@farmerrice.com';
    const fromName = process.env.SENDGRID_FROM_NAME || 'Farmer Rice';
    
    const msg = {
      to: user.email,
      from: {
        email: fromEmail,
        name: fromName
      },
      subject: 'Password Reset Successful - Farmer Rice',
      text: `Hello ${user.name},\n\nYour password has been successfully reset.\n\nIf you did not perform this action, please contact our support team immediately.\n\nThank you,\nThe Farmer Rice Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #4CAF50; padding: 20px; text-align: center; color: white;">
            <h1>Farmer Rice</h1>
          </div>
          <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
            <p>Hello ${user.name},</p>
            <p>Your password has been successfully reset.</p>
            <p>If you did not perform this action, please contact our support team immediately.</p>
            <p>Thank you,<br>The Farmer Rice Team</p>
          </div>
          <div style="text-align: center; padding: 10px; font-size: 12px; color: #777;">
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      `
    };

    const result = await sgMail.send(msg);
    logger.info(`Password reset confirmation email sent to ${user.email}`);
    return {
      success: true,
      message: 'Password reset confirmation email sent successfully'
    };
  } catch (error) {
    logger.error(`Failed to send password reset confirmation email: ${error.message}`);
    throw error;
  }
};

module.exports = {
  sendEmail,
  sendOrderConfirmation,
  sendPaymentConfirmation,
  sendPasswordReset,
  sendLowStockAlert,
  sendOrderStatusUpdate,
  sendFarmerPayment,
  sendAnnouncement,
  sendPasswordResetOTP,
  sendPasswordResetConfirmation
}; 