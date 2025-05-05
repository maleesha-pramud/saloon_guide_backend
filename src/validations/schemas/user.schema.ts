import Joi from 'joi';

// User creation validation schema
export const createUserSchema = Joi.object({
    name: Joi.string().required().min(2).max(100),
    email: Joi.string().email().required(),
    password: Joi.string()
        .required()
        .min(6)
        .pattern(new RegExp('^(?=.*[a-zA-Z])(?=.*[0-9])'))
        .message('Password must be at least 6 characters long and contain at least one letter and one number'),
    phone: Joi.string()
        .pattern(/^\+?[0-9]{10,15}$/)
        .message('Invalid phone number format')
        .allow(null, '')
        .optional()
});

// User update validation schema
export const updateUserSchema = Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    email: Joi.string().email().optional(),
    password: Joi.string()
        .min(6)
        .pattern(new RegExp('^(?=.*[a-zA-Z])(?=.*[0-9])'))
        .message('Password must be at least 6 characters long and contain at least one letter and one number')
        .optional(),
    phone: Joi.string()
        .pattern(/^\+?[0-9]{10,15}$/)
        .message('Invalid phone number format')
        .allow(null, '')
        .optional()
}).min(1).message('At least one field must be provided for update');

// Login validation schema
export const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});
