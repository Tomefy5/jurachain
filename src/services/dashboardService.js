/**
 * Dashboard Service for JusticeAutomation platform
 * Handles user document tracking, status management, and analytics integration
 */

// Mock Supabase for now - will be replaced with proper import
const supabase = {
    from: () => ({
        select: () => ({
            eq: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
                single: () => Promise.resolve({ data: null, error: null })
            })
        }),
        update: () => ({
            eq: () => ({
                select: () => ({
                    single: () => Promise.resolve({ data: null, error: null })
                })
            })
        }),
        insert: () => Promise.resolve({ error: null })
    })
};
const axios = require('axios');

class DashboardService {
    constructor() {
        this.analyticsServiceUrl = process.env.ANALYTICS_SERVICE_URL || 'http://analytics:8000';
    }

    /**
     * Get user dashboard data with document statistics
     * Requirement 5.1: Display all documents associated with a user
     */
    async getUserDashboard(userId) {
        try {
            // Fetch user documents from Supabase
            const { data: documents, error: documentsError } = await supabase
                .from('legal_documents')
                .select(`
                    id,
                    type,
                    title,
                    status,
                    language,
                    metadata,
                    created_at,
                    updated_at,
                    signed_at,
                    archived_at,
                    parties (
                        id,
                        name,
                        email,
                        role
                    ),
                    digital_signatures (
                        id,
                        status,
                        timestamp,
                        signer_name
                    ),
                    risk_assessments (
                        id,
                        risk_level,
                        risk_type,
                        status
                    )
                `)
                .eq('created_by', userId)
                .order('created_at', { ascending: false });

            if (documentsError) {
                throw new Error(`Failed to fetch documents: ${documentsError.message}`);
            }

            // Calculate document statistics
            const stats = this.calculateDocumentStats(documents || []);

            // Get analytics data from DuckDB service
            let analyticsData = {};
            try {
                const analyticsResponse = await axios.get(
                    `${this.analyticsServiceUrl}/analytics/user/${userId}`,
                    { timeout: 5000 }
                );
                analyticsData = analyticsResponse.data;
            } catch (analyticsError) {
                console.warn('Analytics service unavailable:', analyticsError.message);
                analyticsData = {
                    documents: { total: 0, successful: 0, failed: 0, avg_generation_time: 0 },
                    blockchain: { total_transactions: 0, successful_transactions: 0, avg_transaction_time: 0 }
                };
            }

            return {
                success: true,
                data: {
                    documents: documents || [],
                    statistics: stats,
                    analytics: analyticsData,
                    lastUpdated: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error('Dashboard service error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Calculate document statistics for dashboard
     * Requirement 5.2: Indicate status of each contract (in progress, signed, archived)
     */
    calculateDocumentStats(documents) {
        const stats = {
            total: documents.length,
            byStatus: {
                draft: 0,
                in_review: 0,
                pending_signature: 0,
                signed: 0,
                archived: 0,
                cancelled: 0
            },
            byType: {},
            byLanguage: {},
            riskSummary: {
                low: 0,
                medium: 0,
                high: 0,
                critical: 0
            },
            recentActivity: []
        };

        documents.forEach(doc => {
            // Count by status
            if (stats.byStatus.hasOwnProperty(doc.status)) {
                stats.byStatus[doc.status]++;
            }

            // Count by type
            stats.byType[doc.type] = (stats.byType[doc.type] || 0) + 1;

            // Count by language
            stats.byLanguage[doc.language] = (stats.byLanguage[doc.language] || 0) + 1;

            // Risk assessment summary
            if (doc.risk_assessments && doc.risk_assessments.length > 0) {
                const highestRisk = doc.risk_assessments.reduce((max, risk) => {
                    const riskLevels = { low: 1, medium: 2, high: 3, critical: 4 };
                    return riskLevels[risk.risk_level] > riskLevels[max.risk_level] ? risk : max;
                });
                stats.riskSummary[highestRisk.risk_level]++;
            }

            // Recent activity (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            if (new Date(doc.updated_at) > thirtyDaysAgo) {
                stats.recentActivity.push({
                    documentId: doc.id,
                    title: doc.title,
                    status: doc.status,
                    updatedAt: doc.updated_at
                });
            }
        });

        // Sort recent activity by date
        stats.recentActivity.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        stats.recentActivity = stats.recentActivity.slice(0, 10); // Keep only 10 most recent

        return stats;
    }

    /**
     * Update document status and trigger notifications
     * Requirement 5.3: Notify user when document status changes
     */
    async updateDocumentStatus(documentId, newStatus, userId) {
        try {
            // Get current document
            const { data: currentDoc, error: fetchError } = await supabase
                .from('legal_documents')
                .select('status, title, created_by')
                .eq('id', documentId)
                .single();

            if (fetchError) {
                throw new Error(`Failed to fetch document: ${fetchError.message}`);
            }

            // Check if user owns the document
            if (currentDoc.created_by !== userId) {
                throw new Error('Unauthorized: User does not own this document');
            }

            const oldStatus = currentDoc.status;

            // Update document status
            const updateData = {
                status: newStatus,
                updated_at: new Date().toISOString()
            };

            // Add specific timestamps for certain statuses
            if (newStatus === 'signed') {
                updateData.signed_at = new Date().toISOString();
            } else if (newStatus === 'archived') {
                updateData.archived_at = new Date().toISOString();
            }

            const { data: updatedDoc, error: updateError } = await supabase
                .from('legal_documents')
                .update(updateData)
                .eq('id', documentId)
                .select()
                .single();

            if (updateError) {
                throw new Error(`Failed to update document: ${updateError.message}`);
            }

            // Send notification about status change
            await this.sendStatusChangeNotification(userId, documentId, currentDoc.title, oldStatus, newStatus);

            // Record analytics event
            await this.recordAnalyticsEvent(userId, documentId, 'status_change', {
                old_status: oldStatus,
                new_status: newStatus,
                document_type: updatedDoc.type
            });

            return {
                success: true,
                data: updatedDoc,
                message: `Document status updated from ${oldStatus} to ${newStatus}`
            };

        } catch (error) {
            console.error('Status update error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send notification for status changes
     * Requirement 5.3: Notify user when document status changes
     */
    async sendStatusChangeNotification(userId, documentId, documentTitle, oldStatus, newStatus) {
        try {
            // Get user preferences
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('email, name, preferences')
                .eq('id', userId)
                .single();

            if (userError || !user.preferences?.notifications) {
                return; // Skip notification if user disabled them
            }

            const notification = {
                userId,
                type: 'status_change',
                title: 'Changement de statut de document',
                message: `Le document "${documentTitle}" est passé de "${this.getStatusLabel(oldStatus)}" à "${this.getStatusLabel(newStatus)}"`,
                data: {
                    documentId,
                    documentTitle,
                    oldStatus,
                    newStatus
                },
                createdAt: new Date().toISOString()
            };

            // Store notification in database
            const { error: notificationError } = await supabase
                .from('notifications')
                .insert(notification);

            if (notificationError) {
                console.error('Failed to store notification:', notificationError);
            }

            // Send real-time notification via WebSocket if available
            // This would integrate with the WebSocket service
            console.log(`Notification sent to user ${userId}: ${notification.message}`);

        } catch (error) {
            console.error('Notification error:', error);
        }
    }

    /**
     * Get user-friendly status labels
     */
    getStatusLabel(status) {
        const labels = {
            draft: 'Brouillon',
            in_review: 'En révision',
            pending_signature: 'En attente de signature',
            signed: 'Signé',
            archived: 'Archivé',
            cancelled: 'Annulé'
        };
        return labels[status] || status;
    }

    /**
     * Record analytics event in DuckDB
     * Requirement 5.4: Use DuckDB for statistics and analytics
     */
    async recordAnalyticsEvent(userId, documentId, eventType, metadata = {}) {
        try {
            const event = {
                user_id: userId,
                document_id: documentId,
                event_type: eventType,
                status: 'success',
                metadata: metadata
            };

            await axios.post(
                `${this.analyticsServiceUrl}/events/document`,
                event,
                { timeout: 3000 }
            );

        } catch (error) {
            console.warn('Failed to record analytics event:', error.message);
        }
    }

    /**
     * Get document notifications for user
     */
    async getUserNotifications(userId, limit = 20) {
        try {
            const { data: notifications, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('userId', userId)
                .order('createdAt', { ascending: false })
                .limit(limit);

            if (error) {
                throw new Error(`Failed to fetch notifications: ${error.message}`);
            }

            return {
                success: true,
                data: notifications || []
            };

        } catch (error) {
            console.error('Notifications fetch error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Mark notification as read
     */
    async markNotificationRead(notificationId, userId) {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .update({ read: true, readAt: new Date().toISOString() })
                .eq('id', notificationId)
                .eq('userId', userId)
                .select()
                .single();

            if (error) {
                throw new Error(`Failed to mark notification as read: ${error.message}`);
            }

            return {
                success: true,
                data
            };

        } catch (error) {
            console.error('Mark notification read error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = DashboardService;