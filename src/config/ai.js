/**
 * AI Services Configuration
 * Manages configuration for Ollama and Gemini AI services
 */

const aiConfig = {
    // Ollama Configuration (Local AI)
    ollama: {
        url: process.env.OLLAMA_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'llama2',
        timeout: parseInt(process.env.OLLAMA_TIMEOUT) || 30000,
        maxRetries: parseInt(process.env.OLLAMA_MAX_RETRIES) || 3,
        options: {
            temperature: parseFloat(process.env.OLLAMA_TEMPERATURE) || 0.3,
            top_p: parseFloat(process.env.OLLAMA_TOP_P) || 0.9,
            max_tokens: parseInt(process.env.OLLAMA_MAX_TOKENS) || 4000,
            repeat_penalty: parseFloat(process.env.OLLAMA_REPEAT_PENALTY) || 1.1
        }
    },

    // Gemini Configuration (Cloud AI)
    gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || 'gemini-pro',
        timeout: parseInt(process.env.GEMINI_TIMEOUT) || 30000,
        maxRetries: parseInt(process.env.GEMINI_MAX_RETRIES) || 3,
        options: {
            temperature: parseFloat(process.env.GEMINI_TEMPERATURE) || 0.3,
            topP: parseFloat(process.env.GEMINI_TOP_P) || 0.9,
            topK: parseInt(process.env.GEMINI_TOP_K) || 40,
            maxOutputTokens: parseInt(process.env.GEMINI_MAX_TOKENS) || 4000
        }
    },

    // Fallback Strategy
    fallback: {
        enabled: process.env.AI_FALLBACK_ENABLED !== 'false',
        primaryService: process.env.AI_PRIMARY_SERVICE || 'ollama', // 'ollama' or 'gemini'
        retryDelay: parseInt(process.env.AI_RETRY_DELAY) || 1000, // milliseconds
        maxTotalRetries: parseInt(process.env.AI_MAX_TOTAL_RETRIES) || 5
    },

    // Document Generation Settings
    generation: {
        maxPromptLength: parseInt(process.env.AI_MAX_PROMPT_LENGTH) || 8000,
        minDocumentLength: parseInt(process.env.AI_MIN_DOCUMENT_LENGTH) || 500,
        maxDocumentLength: parseInt(process.env.AI_MAX_DOCUMENT_LENGTH) || 50000,
        complianceThreshold: parseInt(process.env.AI_COMPLIANCE_THRESHOLD) || 70
    },

    // Translation Settings
    translation: {
        enabled: process.env.AI_TRANSLATION_ENABLED !== 'false',
        supportedLanguages: ['fr', 'mg', 'en'],
        preferredService: process.env.AI_TRANSLATION_SERVICE || 'gemini' // Gemini is better for multilingual
    },

    // Monitoring and Logging
    monitoring: {
        logRequests: process.env.AI_LOG_REQUESTS === 'true',
        logResponses: process.env.AI_LOG_RESPONSES === 'true',
        trackPerformance: process.env.AI_TRACK_PERFORMANCE !== 'false',
        alertOnFailure: process.env.AI_ALERT_ON_FAILURE === 'true'
    }
};

/**
 * Validate AI configuration
 * @returns {Object} Validation result
 */
function validateConfig() {
    const errors = [];
    const warnings = [];

    // Check if at least one AI service is configured
    const hasOllama = aiConfig.ollama.url && aiConfig.ollama.model;
    const hasGemini = aiConfig.gemini.apiKey && aiConfig.gemini.model;

    if (!hasOllama && !hasGemini) {
        errors.push('At least one AI service (Ollama or Gemini) must be configured');
    }

    // Warn if primary service is not available
    if (aiConfig.fallback.primaryService === 'ollama' && !hasOllama) {
        warnings.push('Primary service (Ollama) is not configured, will use Gemini');
        aiConfig.fallback.primaryService = 'gemini';
    } else if (aiConfig.fallback.primaryService === 'gemini' && !hasGemini) {
        warnings.push('Primary service (Gemini) is not configured, will use Ollama');
        aiConfig.fallback.primaryService = 'ollama';
    }

    // Validate timeout values
    if (aiConfig.ollama.timeout < 5000) {
        warnings.push('Ollama timeout is very low, may cause premature failures');
    }

    if (aiConfig.gemini.timeout < 5000) {
        warnings.push('Gemini timeout is very low, may cause premature failures');
    }

    // Validate temperature values
    if (aiConfig.ollama.options.temperature > 1.0 || aiConfig.ollama.options.temperature < 0.0) {
        errors.push('Ollama temperature must be between 0.0 and 1.0');
    }

    if (aiConfig.gemini.options.temperature > 1.0 || aiConfig.gemini.options.temperature < 0.0) {
        errors.push('Gemini temperature must be between 0.0 and 1.0');
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        hasOllama,
        hasGemini
    };
}

/**
 * Get service availability status
 * @returns {Object} Service status
 */
function getServiceStatus() {
    const validation = validateConfig();

    return {
        ollama: {
            configured: validation.hasOllama,
            url: aiConfig.ollama.url,
            model: aiConfig.ollama.model
        },
        gemini: {
            configured: validation.hasGemini,
            model: aiConfig.gemini.model,
            hasApiKey: !!aiConfig.gemini.apiKey
        },
        fallback: {
            enabled: aiConfig.fallback.enabled,
            primaryService: aiConfig.fallback.primaryService
        }
    };
}

/**
 * Get configuration for specific service
 * @param {string} service - Service name ('ollama' or 'gemini')
 * @returns {Object} Service configuration
 */
function getServiceConfig(service) {
    if (service === 'ollama') {
        return aiConfig.ollama;
    } else if (service === 'gemini') {
        return aiConfig.gemini;
    } else {
        throw new Error(`Unknown service: ${service}`);
    }
}

module.exports = {
    aiConfig,
    validateConfig,
    getServiceStatus,
    getServiceConfig
};