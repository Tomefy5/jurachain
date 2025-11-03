const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { validationSchemas, validateRequest } = require('../middleware/validation');
const BlockchainService = require('../services/blockchainService');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Initialize blockchain service
const blockchainService = new BlockchainService();

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Sign document with blockchain
router.post('/sign/:id',
    validationSchemas.signDocumentBlockchain,
    validateRequest,
    asyncHandler(async (req, res) => {
        const documentId = req.params.id;
        const { signature: signatureData } = req.body;
        const userId = req.user.id;

        try {
            // Récupérer le document depuis Supabase
            const { data: document, error: docError } = await supabase
                .from('legal_documents')
                .select('*')
                .eq('id', documentId)
                .single();

            if (docError || !document) {
                return res.status(404).json({
                    success: false,
                    error: 'Document non trouvé'
                });
            }

            // Créer l'objet signature
            const digitalSignature = {
                id: require('crypto').randomUUID(),
                documentId,
                signerId: userId,
                signerName: req.user.name || req.user.email,
                signerEmail: req.user.email,
                signature: signatureData,
                timestamp: new Date(),
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                status: 'signed'
            };

            // Enregistrer sur blockchain
            const blockchainRecord = await blockchainService.recordSignature(digitalSignature);
            digitalSignature.blockchainHash = blockchainRecord.transactionHash;
            digitalSignature.blockchainRecord = blockchainRecord;

            // Sauvegarder la signature en base
            const { data: savedSignature, error: sigError } = await supabase
                .from('digital_signatures')
                .insert([{
                    id: digitalSignature.id,
                    document_id: digitalSignature.documentId,
                    signer_id: digitalSignature.signerId,
                    signer_name: digitalSignature.signerName,
                    signer_email: digitalSignature.signerEmail,
                    signature: digitalSignature.signature,
                    timestamp: digitalSignature.timestamp,
                    ip_address: digitalSignature.ipAddress,
                    user_agent: digitalSignature.userAgent,
                    status: digitalSignature.status,
                    blockchain_hash: digitalSignature.blockchainHash,
                    blockchain_record: digitalSignature.blockchainRecord
                }])
                .select()
                .single();

            if (sigError) {
                console.error('Erreur sauvegarde signature:', sigError);
                return res.status(500).json({
                    success: false,
                    error: 'Erreur lors de la sauvegarde de la signature'
                });
            }

            // Mettre à jour le statut du document
            await supabase
                .from('legal_documents')
                .update({
                    status: 'signed',
                    signed_at: new Date()
                })
                .eq('id', documentId);

            res.json({
                success: true,
                message: 'Document signé avec succès et enregistré sur blockchain',
                signature: savedSignature,
                blockchainRecord,
                network: blockchainRecord.network
            });

        } catch (error) {
            console.error('Erreur signature blockchain:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la signature blockchain',
                details: error.message
            });
        }
    })
);

// Verify document signature
router.get('/verify/:id',
    validationSchemas.verifySignature,
    validateRequest,
    asyncHandler(async (req, res) => {
        const signatureId = req.params.id;

        try {
            // Récupérer la signature depuis Supabase
            const { data: signature, error: sigError } = await supabase
                .from('digital_signatures')
                .select('*')
                .eq('id', signatureId)
                .single();

            if (sigError || !signature) {
                return res.status(404).json({
                    success: false,
                    error: 'Signature non trouvée'
                });
            }

            // Convertir les données de la base vers le format attendu
            const digitalSignature = {
                id: signature.id,
                documentId: signature.document_id,
                signerId: signature.signer_id,
                signerName: signature.signer_name,
                signerEmail: signature.signer_email,
                signature: signature.signature,
                timestamp: new Date(signature.timestamp),
                ipAddress: signature.ip_address,
                userAgent: signature.user_agent,
                status: signature.status,
                blockchainHash: signature.blockchain_hash,
                blockchainRecord: signature.blockchain_record
            };

            // Vérifier sur blockchain
            const verificationResult = await blockchainService.verifySignature(
                signature.blockchain_record?.id,
                digitalSignature
            );

            res.json({
                success: true,
                verification: verificationResult,
                signature: digitalSignature
            });

        } catch (error) {
            console.error('Erreur vérification signature:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la vérification',
                details: error.message
            });
        }
    })
);

// Generate cryptographic proof for document
router.post('/proof/:id',
    validationSchemas.generateProof,
    validateRequest,
    asyncHandler(async (req, res) => {
        const documentId = req.params.id;

        try {
            // Récupérer le document
            const { data: document, error: docError } = await supabase
                .from('legal_documents')
                .select('*')
                .eq('id', documentId)
                .single();

            if (docError || !document) {
                return res.status(404).json({
                    success: false,
                    error: 'Document non trouvé'
                });
            }

            // Convertir vers le format attendu
            const legalDocument = {
                id: document.id,
                content: document.content,
                parties: document.parties || []
            };

            // Générer la preuve cryptographique
            const proof = await blockchainService.generateProof(legalDocument);

            res.json({
                success: true,
                message: 'Preuve cryptographique générée',
                proof,
                documentId
            });

        } catch (error) {
            console.error('Erreur génération preuve:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la génération de preuve',
                details: error.message
            });
        }
    })
);

// Get blockchain transaction history
router.get('/transactions',
    validationSchemas.blockchainTransactions,
    validateRequest,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;

        try {
            // Récupérer les signatures de l'utilisateur
            const { data: signatures, error } = await supabase
                .from('digital_signatures')
                .select(`
                    *,
                    legal_documents (
                        id,
                        title,
                        type,
                        status
                    )
                `)
                .eq('signer_id', userId)
                .order('timestamp', { ascending: false });

            if (error) {
                throw error;
            }

            const transactions = signatures.map(sig => ({
                id: sig.id,
                documentId: sig.document_id,
                documentTitle: sig.legal_documents?.title,
                documentType: sig.legal_documents?.type,
                signatureDate: sig.timestamp,
                blockchainHash: sig.blockchain_hash,
                network: sig.blockchain_record?.network,
                status: sig.status
            }));

            res.json({
                success: true,
                transactions,
                total: transactions.length
            });

        } catch (error) {
            console.error('Erreur récupération transactions:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la récupération des transactions',
                details: error.message
            });
        }
    })
);

// Get blockchain service status
router.get('/status',
    asyncHandler(async (req, res) => {
        const status = blockchainService.getStatus();

        res.json({
            success: true,
            status,
            timestamp: new Date()
        });
    })
);

module.exports = router;