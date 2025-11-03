const { body, param, query, validationResult } = require('express-validator');
const { AppError } = require('./errorHandler');

const validateRequest = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(error => ({
            field: error.path,
            message: error.msg,
            value: error.value
        }));

        throw new AppError('Données de requête invalides', 400, 'VALIDATION_ERROR');
    }

    next();
};

// Common validation rules
const commonValidations = {
    email: body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Adresse email invalide'),

    password: body('password')
        .isLength({ min: 8 })
        .withMessage('Le mot de passe doit contenir au moins 8 caractères')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial'),

    documentId: param('id')
        .isUUID()
        .withMessage('ID de document invalide'),

    documentType: body('type')
        .isIn(['contract', 'lease', 'sale', 'partnership', 'employment'])
        .withMessage('Type de document invalide'),

    language: body('language')
        .isIn(['fr', 'mg'])
        .withMessage('Langue non supportée (fr ou mg uniquement)'),

    pagination: [
        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Le numéro de page doit être un entier positif'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('La limite doit être entre 1 et 100')
    ]
};

// Specific validation schemas
const validationSchemas = {
    register: [
        commonValidations.email,
        commonValidations.password,
        body('firstName')
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('Le prénom doit contenir entre 2 et 50 caractères'),
        body('lastName')
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('Le nom doit contenir entre 2 et 50 caractères'),
        body('phone')
            .optional()
            .isMobilePhone('mg-MG')
            .withMessage('Numéro de téléphone malgache invalide')
    ],

    login: [
        commonValidations.email,
        body('password')
            .notEmpty()
            .withMessage('Mot de passe requis')
    ],

    generateDocument: [
        body('prompt')
            .trim()
            .isLength({ min: 10, max: 2000 })
            .withMessage('La description doit contenir entre 10 et 2000 caractères'),
        commonValidations.documentType,
        commonValidations.language,
        body('parties')
            .isArray({ min: 1, max: 10 })
            .withMessage('Au moins une partie est requise (maximum 10)'),
        body('parties.*.name')
            .trim()
            .isLength({ min: 2, max: 100 })
            .withMessage('Le nom de la partie doit contenir entre 2 et 100 caractères'),
        body('parties.*.role')
            .isIn(['buyer', 'seller', 'tenant', 'landlord', 'employer', 'employee', 'partner'])
            .withMessage('Rôle de partie invalide')
    ],

    updateDocument: [
        commonValidations.documentId,
        body('content')
            .optional()
            .trim()
            .isLength({ min: 10, max: 50000 })
            .withMessage('Le contenu doit contenir entre 10 et 50000 caractères'),
        body('status')
            .optional()
            .isIn(['draft', 'review', 'approved', 'signed', 'archived'])
            .withMessage('Statut de document invalide')
    ],

    signDocument: [
        commonValidations.documentId,
        body('signature')
            .notEmpty()
            .withMessage('Signature requise'),
        body('signatureType')
            .isIn(['digital', 'electronic'])
            .withMessage('Type de signature invalide')
    ],

    mfaRequest: [
        body('method')
            .isIn(['email', 'sms'])
            .withMessage('Méthode MFA invalide (email ou sms)'),
        body('tempToken')
            .notEmpty()
            .withMessage('Token temporaire requis')
    ],

    mfaVerify: [
        body('code')
            .isLength({ min: 6, max: 6 })
            .isNumeric()
            .withMessage('Code MFA invalide (6 chiffres requis)'),
        body('tempToken')
            .notEmpty()
            .withMessage('Token temporaire requis')
    ],

    updateRole: [
        body('role')
            .isIn(['admin', 'lawyer', 'user', 'guest'])
            .withMessage('Rôle invalide'),
        body('permissions')
            .optional()
            .isArray()
            .withMessage('Les permissions doivent être un tableau'),
        body('permissions.*')
            .optional()
            .matches(/^[a-z]+:[a-z*]+$/)
            .withMessage('Format de permission invalide (ex: documents:read)')
    ],

    changePassword: [
        body('currentPassword')
            .notEmpty()
            .withMessage('Mot de passe actuel requis'),
        commonValidations.password
    ],

    translateDocument: [
        commonValidations.documentId,
        body('targetLanguage')
            .isIn(['fr', 'mg', 'en'])
            .withMessage('Langue cible invalide (fr, mg, ou en)'),
        body('content')
            .optional()
            .trim()
            .isLength({ min: 1, max: 50000 })
            .withMessage('Le contenu doit contenir entre 1 et 50000 caractères'),
        body('sourceLanguage')
            .optional()
            .isIn(['fr', 'mg', 'en'])
            .withMessage('Langue source invalide (fr, mg, ou en)'),
        body('type')
            .optional()
            .isIn(['contract', 'lease', 'sale_agreement', 'employment_contract', 'service_agreement', 'partnership_agreement', 'non_disclosure_agreement', 'power_of_attorney', 'other'])
            .withMessage('Type de document invalide')
    ],

    compareTranslation: [
        commonValidations.documentId,
        body('targetLanguage')
            .isIn(['fr', 'mg', 'en'])
            .withMessage('Langue cible invalide (fr, mg, ou en)'),
        body('originalContent')
            .trim()
            .isLength({ min: 1, max: 50000 })
            .withMessage('Le contenu original doit contenir entre 1 et 50000 caractères'),
        body('translatedContent')
            .trim()
            .isLength({ min: 1, max: 50000 })
            .withMessage('Le contenu traduit doit contenir entre 1 et 50000 caractères'),
        body('sourceLanguage')
            .optional()
            .isIn(['fr', 'mg', 'en'])
            .withMessage('Langue source invalide (fr, mg, ou en)')
    ],

    generateMultilingual: [
        body('prompt')
            .optional()
            .trim()
            .isLength({ min: 10, max: 2000 })
            .withMessage('La description doit contenir entre 10 et 2000 caractères'),
        commonValidations.documentType,
        commonValidations.language,
        body('parties')
            .isArray({ min: 1, max: 10 })
            .withMessage('Au moins une partie est requise (maximum 10)'),
        body('targetLanguages')
            .optional()
            .isArray({ max: 5 })
            .withMessage('Maximum 5 langues cibles'),
        body('targetLanguages.*')
            .optional()
            .isIn(['fr', 'mg', 'en'])
            .withMessage('Langue cible invalide dans le tableau')
    ],

    // Blockchain validation schemas
    signDocumentBlockchain: [
        commonValidations.documentId,
        body('signature')
            .trim()
            .isLength({ min: 1, max: 10000 })
            .withMessage('Signature requise (maximum 10000 caractères)'),
        body('signerName')
            .optional()
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage('Nom du signataire invalide (maximum 100 caractères)'),
        body('verificationCode')
            .optional()
            .trim()
            .isLength({ max: 100 })
            .withMessage('Code de vérification trop long (maximum 100 caractères)')
    ],

    verifySignature: [
        param('id')
            .isUUID()
            .withMessage('ID de signature invalide')
    ],

    generateProof: [
        commonValidations.documentId
    ],

    blockchainTransactions: [
        ...commonValidations.pagination,
        query('network')
            .optional()
            .isIn(['hedera', 'polygon'])
            .withMessage('Réseau blockchain invalide (hedera ou polygon)'),
        query('status')
            .optional()
            .isIn(['pending', 'confirmed', 'failed'])
            .withMessage('Statut de transaction invalide')
    ],

    // Collaborative editing validation schemas
    createCollaborativeDocument: [
        body('title')
            .optional()
            .trim()
            .isLength({ min: 1, max: 200 })
            .withMessage('Le titre doit contenir entre 1 et 200 caractères'),
        body('content')
            .optional()
            .trim()
            .isLength({ max: 100000 })
            .withMessage('Le contenu ne peut pas dépasser 100000 caractères'),
        body('type')
            .optional()
            .isIn(['contract', 'agreement', 'document', 'legal_brief', 'memo'])
            .withMessage('Type de document collaboratif invalide')
    ],

    joinCollaborativeSession: [
        param('documentId')
            .isUUID()
            .withMessage('ID de document invalide'),
        body('socketId')
            .optional()
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage('ID de socket invalide')
    ],

    leaveCollaborativeSession: [
        param('sessionId')
            .isUUID()
            .withMessage('ID de session invalide')
    ],

    getDocumentContent: [
        param('documentId')
            .isUUID()
            .withMessage('ID de document invalide')
    ],

    updateDocumentContent: [
        param('documentId')
            .isUUID()
            .withMessage('ID de document invalide'),
        body('content')
            .trim()
            .isLength({ min: 1, max: 100000 })
            .withMessage('Le contenu doit contenir entre 1 et 100000 caractères')
    ],

    getCollaborators: [
        param('documentId')
            .isUUID()
            .withMessage('ID de document invalide')
    ],

    notifyCollaborators: [
        param('documentId')
            .isUUID()
            .withMessage('ID de document invalide'),
        body('message')
            .trim()
            .isLength({ min: 1, max: 500 })
            .withMessage('Le message doit contenir entre 1 et 500 caractères'),
        body('type')
            .optional()
            .isIn(['info', 'warning', 'success', 'error'])
            .withMessage('Type de notification invalide'),
        body('excludeSelf')
            .optional()
            .isBoolean()
            .withMessage('excludeSelf doit être un booléen')
    ],

    getDocumentHistory: [
        param('documentId')
            .isUUID()
            .withMessage('ID de document invalide')
    ],

    autoSaveDocument: [
        param('documentId')
            .isUUID()
            .withMessage('ID de document invalide'),
        body('content')
            .trim()
            .isLength({ min: 1, max: 100000 })
            .withMessage('Le contenu doit contenir entre 1 et 100000 caractères')
    ]
};

module.exports = {
    validateRequest,
    validationSchemas,
    commonValidations
};