const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Basic health check
router.get('/', async (req, res) => {
    const healthCheck = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
    };

    res.status(200).json(healthCheck);
});

// Detailed health check with dependencies
router.get('/detailed', async (req, res) => {
    const checks = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        services: {}
    };

    // Check Supabase connection
    try {
        const { data, error } = await supabase.from('_health').select('*').limit(1);
        checks.services.supabase = {
            status: error ? 'ERROR' : 'OK',
            message: error ? error.message : 'Connected',
            responseTime: Date.now()
        };
    } catch (error) {
        checks.services.supabase = {
            status: 'ERROR',
            message: 'Connection failed',
            error: error.message
        };
    }

    // Check Ollama service
    try {
        const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        const response = await fetch(`${ollamaUrl}/api/tags`, {
            method: 'GET',
            timeout: 5000
        });

        checks.services.ollama = {
            status: response.ok ? 'OK' : 'ERROR',
            message: response.ok ? 'Connected' : 'Service unavailable',
            url: ollamaUrl
        };
    } catch (error) {
        checks.services.ollama = {
            status: 'ERROR',
            message: 'Connection failed',
            error: error.message
        };
    }

    // Check system resources
    checks.system = {
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            unit: 'MB'
        },
        cpu: {
            usage: process.cpuUsage()
        }
    };

    // Determine overall status
    const serviceStatuses = Object.values(checks.services).map(service => service.status);
    const hasErrors = serviceStatuses.includes('ERROR');

    if (hasErrors) {
        checks.status = 'DEGRADED';
        res.status(503);
    }

    res.json(checks);
});

// Readiness probe
router.get('/ready', async (req, res) => {
    try {
        // Check if essential services are ready
        const { data, error } = await supabase.from('_health').select('*').limit(1);

        if (error) {
            return res.status(503).json({
                status: 'NOT_READY',
                message: 'Database not ready',
                error: error.message
            });
        }

        res.status(200).json({
            status: 'READY',
            message: 'Service is ready to accept requests'
        });
    } catch (error) {
        res.status(503).json({
            status: 'NOT_READY',
            message: 'Service not ready',
            error: error.message
        });
    }
});

// Liveness probe
router.get('/live', (req, res) => {
    res.status(200).json({
        status: 'ALIVE',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

module.exports = router;