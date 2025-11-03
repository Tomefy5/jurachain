const { createClient } = require('@supabase/supabase-js');
const securityConfig = require('../config/security');

class AuditService {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
    }

    /**
     * Log security event for audit trail
     */
    async logSecurityEvent(eventType, details = {}) {
        try {
            const auditLog = {
                event_type: eventType,
                timestamp: new Date().toISOString(),
                user_id: details.userId || null,
                user_email: details.userEmail || null,
                ip_address: details.ipAddress || null,
                user_agent: details.userAgent || null,
                session_id: details.sessionId || null,
                resource: details.resource || null,
                action: details.action || null,
                result: details.result || 'SUCCESS',
                error_message: details.errorMessage || null,
                metadata: this.sanitizeMetadata(details.metadata || {}),
                severity: this.getEventSeverity(eventType),
                created_at: new Date().toISOString()
            };

            // Store in Supabase (you would need to create an audit_logs table)
            // For now, we'll log to console and could extend to external logging service
            console.log('AUDIT LOG:', JSON.stringify(auditLog, null, 2));

            // In production, you might want to send to external logging service
            // await this.sendToExternalLogger(auditLog);

            return auditLog;
        } catch (error) {
            console.error('Audit logging failed:', error);
            // Don't throw error to avoid breaking main functionality
        }
    }

    /**
     * Log authentication events
     */
    async logAuthEvent(eventType, req, user = null, result = 'SUCCESS', errorMessage = null) {
        const details = {
            userId: user?.id,
            userEmail: user?.email,
            ipAddress: this.getClientIP(req),
            userAgent: req.get('User-Agent'),
            sessionId: user?.sessionId,
            result,
            errorMessage,
            metadata: {
                endpoint: req.path,
                method: req.method,
                role: user?.role
            }
        };

        return this.logSecurityEvent(eventType, details);
    }

    /**
     * Log document access events
     */
    async logDocumentEvent(eventType, req, user, documentId, action, result = 'SUCCESS', errorMessage = null) {
        const details = {
            userId: user.id,
            userEmail: user.email,
            ipAddress: this.getClientIP(req),
            userAgent: req.get('User-Agent'),
            sessionId: user.sessionId,
            resource: `document:${documentId}`,
            action,
            result,
            errorMessage,
            metadata: {
                endpoint: req.path,
                method: req.method,
                role: user.role
            }
        };

        return this.logSecurityEvent(eventType, details);
    }

    /**
     * Log blockchain events
     */
    async logBlockchainEvent(eventType, req, user, transactionHash, action, result = 'SUCCESS', errorMessage = null) {
        const details = {
            userId: user.id,
            userEmail: user.email,
            ipAddress: this.getClientIP(req),
            userAgent: req.get('User-Agent'),
            sessionId: user.sessionId,
            resource: `blockchain:${transactionHash}`,
            action,
            result,
            errorMessage,
            metadata: {
                endpoint: req.path,
                method: req.method,
                role: user.role,
                transactionHash
            }
        };

        return this.logSecurityEvent(eventType, details);
    }

    /**
     * Log suspicious activity
     */
    async logSuspiciousActivity(req, user, reason, details = {}) {
        const auditDetails = {
            userId: user?.id,
            userEmail: user?.email,
            ipAddress: this.getClientIP(req),
            userAgent: req.get('User-Agent'),
            sessionId: user?.sessionId,
            result: 'SUSPICIOUS',
            errorMessage: reason,
            metadata: {
                endpoint: req.path,
                method: req.method,
                reason,
                ...details
            }
        };

        return this.logSecurityEvent('SUSPICIOUS_ACTIVITY', auditDetails);
    }

    /**
     * Get event severity level
     */
    getEventSeverity(eventType) {
        const severityMap = {
            'USER_LOGIN': 'INFO',
            'USER_LOGOUT': 'INFO',
            'USER_REGISTER': 'INFO',
            'PASSWORD_CHANGE': 'MEDIUM',
            'MFA_ENABLE': 'MEDIUM',
            'MFA_DISABLE': 'MEDIUM',
            'ROLE_CHANGE': 'HIGH',
            'PERMISSION_CHANGE': 'HIGH',
            'DOCUMENT_CREATE': 'INFO',
            'DOCUMENT_SIGN': 'MEDIUM',
            'BLOCKCHAIN_TRANSACTION': 'MEDIUM',
            'FAILED_LOGIN': 'MEDIUM',
            'SUSPICIOUS_ACTIVITY': 'HIGH',
            'ACCOUNT_LOCKED': 'HIGH',
            'UNAUTHORIZED_ACCESS': 'CRITICAL',
            'DATA_BREACH': 'CRITICAL'
        };

        return severityMap[eventType] || 'INFO';
    }

    /**
     * Sanitize metadata to remove sensitive information
     */
    sanitizeMetadata(metadata) {
        const sanitized = { ...metadata };

        securityConfig.audit.sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        });

        return sanitized;
    }

    /**
     * Get client IP address
     */
    getClientIP(req) {
        return req.ip ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
            req.get('X-Forwarded-For') ||
            req.get('X-Real-IP') ||
            'unknown';
    }

    /**
     * Query audit logs (admin only)
     */
    async queryAuditLogs(filters = {}, pagination = {}) {
        try {
            const {
                eventType,
                userId,
                startDate,
                endDate,
                severity,
                result
            } = filters;

            const {
                page = 1,
                limit = 50
            } = pagination;

            // This would query your audit logs table
            // For now, returning mock structure
            const mockLogs = {
                logs: [],
                pagination: {
                    page,
                    limit,
                    total: 0,
                    totalPages: 0
                },
                filters: filters
            };

            return mockLogs;
        } catch (error) {
            console.error('Query audit logs error:', error);
            throw error;
        }
    }

    /**
     * Generate security report
     */
    async generateSecurityReport(timeframe = '24h') {
        try {
            const endDate = new Date();
            const startDate = new Date();

            switch (timeframe) {
                case '1h':
                    startDate.setHours(startDate.getHours() - 1);
                    break;
                case '24h':
                    startDate.setDate(startDate.getDate() - 1);
                    break;
                case '7d':
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case '30d':
                    startDate.setDate(startDate.getDate() - 30);
                    break;
                default:
                    startDate.setDate(startDate.getDate() - 1);
            }

            // This would aggregate data from audit logs
            const report = {
                timeframe,
                period: {
                    start: startDate.toISOString(),
                    end: endDate.toISOString()
                },
                summary: {
                    totalEvents: 0,
                    successfulLogins: 0,
                    failedLogins: 0,
                    suspiciousActivities: 0,
                    documentsCreated: 0,
                    blockchainTransactions: 0
                },
                topEvents: [],
                topUsers: [],
                topIPs: [],
                securityAlerts: []
            };

            return report;
        } catch (error) {
            console.error('Generate security report error:', error);
            throw error;
        }
    }

    /**
     * Check for suspicious patterns
     */
    async detectSuspiciousPatterns(userId, ipAddress) {
        try {
            const patterns = {
                rapidRequests: false,
                multipleFailedLogins: false,
                unusualLocation: false,
                suspiciousUserAgent: false
            };

            // Implement pattern detection logic here
            // This would analyze recent audit logs for patterns

            return patterns;
        } catch (error) {
            console.error('Suspicious pattern detection error:', error);
            return {};
        }
    }
}

module.exports = new AuditService();