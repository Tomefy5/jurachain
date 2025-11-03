const express = require('express');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { asyncHandler } = require('../middleware/errorHandler');
const { getServiceStatus, aiConfig } = require('../config/ai');

const router = express.Router();

/**
 * Health check for AI services
 * Tests connectivity and basic functionality of Ollama and Gemini
 */
router.get('/status', asyncHandler(async (req, res) => {
    const serviceStatus = getServiceStatus();
    const healthChecks = {
        ollama: { configured: false, available: false, responseTime: null, error: null },
        gemini: { configured: false, available: false, responseTime: null, error: null },
        overall: { status: 'unknown', availableServices: 0 }
    };

    // Check Ollama health
    if (serviceStatus.ollama.configured) {
        healthChecks.ollama.configured = true;
        try {
            const startTime = Date.now();
            const response = await axios.get(`${aiConfig.ollama.url}/api/tags`, {
                timeout: 5000
            });

            healthChecks.ollama.available = response.status === 200;
            healthChecks.ollama.responseTime = Date.now() - startTime;
            healthChecks.ollama.models = response.data?.models?.map(m => m.name) || [];

            if (healthChecks.ollama.available) {
                healthChecks.overall.availableServices++;
            }
        } catch (error) {
            healthChecks.ollama.error = error.message;
        }
    }

    // Check Gemini health
    if (serviceStatus.gemini.configured) {
        healthChecks.gemini.configured = true;
        try {
            const startTime = Date.now();
            const genAI = new GoogleGenerativeAI(aiConfig.gemini.apiKey);
            const model = genAI.getGenerativeModel({ model: aiConfig.gemini.model });

            // Simple test prompt
            const result = await model.generateContent('Test');
            const response = await result.response;

            healthChecks.gemini.available = !!response.text();
            healthChecks.gemini.responseTime = Date.now() - startTime;

            if (healthChecks.gemini.available) {
                healthChecks.overall.availableServices++;
            }
        } catch (error) {
            healthChecks.gemini.error = error.message;
        }
    }

    // Determine overall status
    if (healthChecks.overall.availableServices === 0) {
        healthChecks.overall.status = 'critical';
    } else if (healthChecks.overall.availableServices === 1) {
        healthChecks.overall.status = 'degraded';
    } else {
        healthChecks.overall.status = 'healthy';
    }

    const httpStatus = healthChecks.overall.status === 'critical' ? 503 : 200;

    res.status(httpStatus).json({
        timestamp: new Date().toISOString(),
        status: healthChecks.overall.status,
        services: healthChecks,
        configuration: {
            fallbackEnabled: aiConfig.fallback.enabled,
            primaryService: aiConfig.fallback.primaryService,
            translationEnabled: aiConfig.translation.enabled
        }
    });
}));

/**
 * Test document generation with both services
 */
router.post('/test-generation', asyncHandler(async (req, res) => {
    const testRequest = {
        type: 'contract',
        language: 'fr',
        description: 'Contrat de test pour vérifier le fonctionnement du générateur IA',
        parties: [
            { name: 'Test User', email: 'test@example.com', role: 'buyer' }
        ],
        jurisdiction: 'Madagascar'
    };

    const results = {
        ollama: { success: false, responseTime: null, error: null, contentLength: 0 },
        gemini: { success: false, responseTime: null, error: null, contentLength: 0 }
    };

    const DocumentGeneratorService = require('../services/documentGenerator');
    const generator = new DocumentGeneratorService();

    // Test Ollama
    try {
        const startTime = Date.now();
        const ollamaResult = await generator.generateWithOllama(testRequest);
        results.ollama.responseTime = Date.now() - startTime;

        if (ollamaResult && ollamaResult.content) {
            results.ollama.success = true;
            results.ollama.contentLength = ollamaResult.content.length;
        }
    } catch (error) {
        results.ollama.error = error.message;
    }

    // Test Gemini
    try {
        const startTime = Date.now();
        const geminiResult = await generator.generateWithGemini(testRequest);
        results.gemini.responseTime = Date.now() - startTime;

        if (geminiResult && geminiResult.content) {
            results.gemini.success = true;
            results.gemini.contentLength = geminiResult.content.length;
        }
    } catch (error) {
        results.gemini.error = error.message;
    }

    const overallSuccess = results.ollama.success || results.gemini.success;
    const httpStatus = overallSuccess ? 200 : 503;

    res.status(httpStatus).json({
        timestamp: new Date().toISOString(),
        testRequest,
        results,
        summary: {
            overallSuccess,
            workingServices: [
                results.ollama.success ? 'ollama' : null,
                results.gemini.success ? 'gemini' : null
            ].filter(Boolean)
        }
    });
}));

/**
 * Get AI service configuration (without sensitive data)
 */
router.get('/config', asyncHandler(async (req, res) => {
    const serviceStatus = getServiceStatus();

    res.json({
        services: {
            ollama: {
                configured: serviceStatus.ollama.configured,
                url: serviceStatus.ollama.url,
                model: serviceStatus.ollama.model,
                timeout: aiConfig.ollama.timeout
            },
            gemini: {
                configured: serviceStatus.gemini.configured,
                model: serviceStatus.gemini.model,
                hasApiKey: serviceStatus.gemini.hasApiKey
            }
        },
        fallback: serviceStatus.fallback,
        generation: {
            maxPromptLength: aiConfig.generation.maxPromptLength,
            minDocumentLength: aiConfig.generation.minDocumentLength,
            complianceThreshold: aiConfig.generation.complianceThreshold
        },
        translation: {
            enabled: aiConfig.translation.enabled,
            supportedLanguages: aiConfig.translation.supportedLanguages,
            preferredService: aiConfig.translation.preferredService
        }
    });
}));

module.exports = router;