/**
 * Text Processing Utilities for Clause Analysis
 * Handles text preprocessing, tokenization, and feature extraction
 */

class TextProcessor {
    constructor() {
        this.stopWords = this.loadStopWords();
        this.legalTerms = this.loadLegalTerms();
        this.riskIndicators = this.loadRiskIndicators();
    }

    /**
     * Preprocess text for analysis
     */
    preprocessText(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }

        // Convert to lowercase
        let processed = text.toLowerCase();

        // Remove special characters but keep legal punctuation
        processed = processed.replace(/[^\w\s\.\,\;\:\!\?\-]/g, ' ');

        // Normalize whitespace
        processed = processed.replace(/\s+/g, ' ').trim();

        // Remove stop words
        const words = processed.split(' ');
        const filteredWords = words.filter(word =>
            word.length > 2 && !this.stopWords.includes(word)
        );

        return filteredWords.join(' ');
    }

    /**
     * Extract features from text for TensorFlow model
     */
    extractFeatures(text, maxFeatures = 100) {
        const features = new Array(maxFeatures).fill(0);
        const processedText = this.preprocessText(text);

        // Feature 1-20: Legal term frequency
        this.legalTerms.forEach((term, index) => {
            if (index < 20) {
                const regex = new RegExp(term, 'gi');
                const matches = (processedText.match(regex) || []).length;
                features[index] = Math.min(matches / 5, 1); // Normalize to 0-1
            }
        });

        // Feature 21-40: Risk indicator frequency
        this.riskIndicators.forEach((indicator, index) => {
            if (index < 20) {
                const regex = new RegExp(indicator, 'gi');
                const matches = (processedText.match(regex) || []).length;
                features[20 + index] = Math.min(matches / 3, 1);
            }
        });

        // Feature 41-60: Text statistics
        const words = processedText.split(' ');
        features[40] = Math.min(words.length / 100, 1); // Text length
        features[41] = Math.min(this.getAverageWordLength(words) / 10, 1); // Avg word length
        features[42] = Math.min(this.getSentenceCount(text) / 20, 1); // Sentence count
        features[43] = this.getExclamationRatio(text); // Exclamation ratio
        features[44] = this.getQuestionRatio(text); // Question ratio
        features[45] = this.getCapitalRatio(text); // Capital letter ratio

        // Feature 46-65: Linguistic patterns
        features[46] = this.hasNegativeLanguage(processedText) ? 1 : 0;
        features[47] = this.hasUrgentLanguage(processedText) ? 1 : 0;
        features[48] = this.hasAbsoluteLanguage(processedText) ? 1 : 0;
        features[49] = this.hasConditionalLanguage(processedText) ? 1 : 0;
        features[50] = this.hasLegalJargon(processedText) ? 1 : 0;

        // Feature 66-85: Clause structure indicators
        features[66] = this.hasListStructure(text) ? 1 : 0;
        features[67] = this.hasNumberedItems(text) ? 1 : 0;
        features[68] = this.hasParentheses(text) ? 1 : 0;
        features[69] = this.hasQuotations(text) ? 1 : 0;
        features[70] = this.hasDates(text) ? 1 : 0;

        // Feature 86-100: Domain-specific indicators
        const remainingFeatures = maxFeatures - 85;
        const domainTerms = this.getDomainSpecificTerms(processedText);
        domainTerms.forEach((score, index) => {
            if (index < remainingFeatures) {
                features[85 + index] = score;
            }
        });

        return features;
    }

    /**
     * Tokenize text into words
     */
    tokenize(text) {
        const processed = this.preprocessText(text);
        return processed.split(' ').filter(word => word.length > 0);
    }

    /**
     * Calculate text similarity using cosine similarity
     */
    calculateSimilarity(text1, text2) {
        const tokens1 = this.tokenize(text1);
        const tokens2 = this.tokenize(text2);

        const allTokens = [...new Set([...tokens1, ...tokens2])];

        const vector1 = allTokens.map(token => tokens1.filter(t => t === token).length);
        const vector2 = allTokens.map(token => tokens2.filter(t => t === token).length);

        return this.cosineSimilarity(vector1, vector2);
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(vec1, vec2) {
        const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
        const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
        const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));

        if (magnitude1 === 0 || magnitude2 === 0) return 0;
        return dotProduct / (magnitude1 * magnitude2);
    }

    /**
     * Load stop words for text filtering
     */
    loadStopWords() {
        return [
            'le', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir', 'que', 'pour',
            'dans', 'ce', 'son', 'une', 'sur', 'avec', 'ne', 'se', 'pas', 'tout', 'plus',
            'par', 'grand', 'en', 'une', 'être', 'et', 'à', 'il', 'avoir', 'ne', 'je',
            'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for',
            'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by'
        ];
    }

    /**
     * Load legal terms for feature extraction
     */
    loadLegalTerms() {
        return [
            'contract', 'contrat', 'agreement', 'accord', 'clause', 'article',
            'party', 'partie', 'obligation', 'right', 'droit', 'liability', 'responsabilité',
            'breach', 'violation', 'termination', 'résiliation', 'penalty', 'pénalité',
            'damages', 'dommages', 'warranty', 'garantie', 'indemnity', 'indemnisation',
            'force majeure', 'cas fortuit', 'arbitration', 'arbitrage', 'jurisdiction',
            'compétence', 'governing law', 'loi applicable', 'signature', 'execution'
        ];
    }

    /**
     * Load risk indicator terms
     */
    loadRiskIndicators() {
        return [
            'unlimited', 'illimité', 'absolute', 'absolu', 'irrevocable', 'irrévocable',
            'waive', 'renoncer', 'forfeit', 'forfaire', 'penalty', 'pénalité',
            'immediate', 'immédiat', 'without notice', 'sans préavis', 'sole discretion',
            'seule discrétion', 'exclusive', 'exclusif', 'perpetual', 'perpétuel',
            'binding', 'contraignant', 'non-negotiable', 'non-négociable'
        ];
    }

    /**
     * Helper methods for feature extraction
     */
    getAverageWordLength(words) {
        if (words.length === 0) return 0;
        return words.reduce((sum, word) => sum + word.length, 0) / words.length;
    }

    getSentenceCount(text) {
        return (text.match(/[.!?]+/g) || []).length;
    }

    getExclamationRatio(text) {
        const exclamations = (text.match(/!/g) || []).length;
        return Math.min(exclamations / text.length * 100, 1);
    }

    getQuestionRatio(text) {
        const questions = (text.match(/\?/g) || []).length;
        return Math.min(questions / text.length * 100, 1);
    }

    getCapitalRatio(text) {
        const capitals = (text.match(/[A-Z]/g) || []).length;
        return Math.min(capitals / text.length, 1);
    }

    hasNegativeLanguage(text) {
        const negativeTerms = ['not', 'no', 'never', 'none', 'nothing', 'pas', 'non', 'jamais', 'rien'];
        return negativeTerms.some(term => text.includes(term));
    }

    hasUrgentLanguage(text) {
        const urgentTerms = ['immediate', 'urgent', 'asap', 'immédiat', 'urgent', 'rapidement'];
        return urgentTerms.some(term => text.includes(term));
    }

    hasAbsoluteLanguage(text) {
        const absoluteTerms = ['all', 'every', 'always', 'never', 'tout', 'tous', 'toujours', 'jamais'];
        return absoluteTerms.some(term => text.includes(term));
    }

    hasConditionalLanguage(text) {
        const conditionalTerms = ['if', 'unless', 'provided', 'si', 'sauf', 'pourvu'];
        return conditionalTerms.some(term => text.includes(term));
    }

    hasLegalJargon(text) {
        const jargonTerms = ['whereas', 'heretofore', 'hereinafter', 'notwithstanding', 'attendu', 'considérant'];
        return jargonTerms.some(term => text.includes(term));
    }

    hasListStructure(text) {
        return /\n\s*[-*•]\s/.test(text) || /\n\s*\d+\.\s/.test(text);
    }

    hasNumberedItems(text) {
        return /\d+\.\s/.test(text);
    }

    hasParentheses(text) {
        return /\([^)]+\)/.test(text);
    }

    hasQuotations(text) {
        return /["']/.test(text);
    }

    hasDates(text) {
        return /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(text);
    }

    getDomainSpecificTerms(text) {
        const terms = [
            'employment', 'emploi', 'salary', 'salaire', 'lease', 'bail',
            'rent', 'loyer', 'purchase', 'achat', 'sale', 'vente',
            'service', 'prestation', 'delivery', 'livraison', 'payment', 'paiement'
        ];

        return terms.map(term => {
            const regex = new RegExp(term, 'gi');
            const matches = (text.match(regex) || []).length;
            return Math.min(matches / 2, 1);
        });
    }
}

module.exports = TextProcessor;