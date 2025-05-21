import Joi from 'joi';

// Time pattern: HH:MM in 24-hour format
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Saloon creation validation schema
export const createSaloonSchema = Joi.object({
    name: Joi.string().required().min(2).max(100),
    description: Joi.string().allow(null, '').optional(),
    address: Joi.string().required().min(5).max(255),
    phone: Joi.string()
        .pattern(/^\+?[0-9]{10,15}$/)
        .message('Invalid phone number format')
        .allow(null, '')
        .optional(),
    email: Joi.string().email().allow(null, '').optional(),
    website: Joi.string().uri().allow(null, '').optional(),
    opening_time: Joi.string()
        .pattern(timePattern)
        .message('Opening time must be in HH:MM format (24-hour)')
        .default('09:00'),
    closing_time: Joi.string()
        .pattern(timePattern)
        .message('Closing time must be in HH:MM format (24-hour)')
        .default('17:00'),
    latitude: Joi.number()
        .precision(8)
        .min(-90)
        .max(90)
        .required()
        .messages({
            'number.min': 'Latitude must be between -90 and 90',
            'number.max': 'Latitude must be between -90 and 90',
            'number.precision': 'Latitude can have at most 8 decimal places',
            'any.required': 'Latitude is required'
        }),
    longitude: Joi.number()
        .precision(8)
        .min(-180)
        .max(180)
        .required()
        .messages({
            'number.min': 'Longitude must be between -180 and 180',
            'number.max': 'Longitude must be between -180 and 180',
            'number.precision': 'Longitude can have at most 8 decimal places',
            'any.required': 'Longitude is required'
        })
}).custom((value, helpers) => {
    // Validate that closing time is after opening time
    if (value.opening_time && value.closing_time) {
        const [openingHour, openingMinute] = value.opening_time.split(':').map(Number);
        const [closingHour, closingMinute] = value.closing_time.split(':').map(Number);

        if (openingHour > closingHour ||
            (openingHour === closingHour && openingMinute >= closingMinute)) {
            return helpers.error('any.invalid', {
                message: 'Closing time must be after opening time'
            });
        }
    }

    return value;
});

// Saloon service validation schema
export const createSaloonServiceSchema = Joi.object({
    name: Joi.string().required().min(2).max(100),
    description: Joi.string().allow(null, '').optional(),
    price: Joi.number().required().positive(),
    duration: Joi.number().integer().min(5).allow(null).optional()
});
