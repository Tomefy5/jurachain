/**
 * TensorFlow Configuration for Clause Analysis
 * Manages TensorFlow.js settings and model configurations
 */

let tf;
try {
    tf = require('@tensorflow/tfjs-node');
} catch (error) {
    console.warn('TensorFlow.js not available in configuration');
    tf = null;
}

class TensorFlowConfig {
    constructor() {
        this.modelConfig = {
            // Model architecture parameters
            inputShape: [100], // Feature vector size
            hiddenLayers: [
                { units: 64, activation: 'relu', dropout: 0.3 },
                { units: 32, activation: 'relu' }
            ],
            outputUnits: 4, // Number of risk levels
            outputActivation: 'softmax',

            // Training parameters
            optimizer: 'adam',
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy'],

            // Performance settings
            batchSize: 32,
            epochs: 100,
            validationSplit: 0.2
        };

        this.riskThresholds = {
            low: 0.25,
            medium: 0.5,
            high: 0.75,
            critical: 0.9
        };

        this.featureConfig = {
            maxFeatures: 100,
            sequenceLength: 200,
            embeddingDim: 50
        };
    }

    /**
     * Initialize TensorFlow backend and settings
     */
    async initializeTensorFlow() {
        if (!tf) {
            console.log('TensorFlow.js not available, skipping initialization');
            return false;
        }

        try {
            // Set TensorFlow backend preferences
            tf.env().set('WEBGL_PACK', false);
            tf.env().set('WEBGL_FORCE_F16_TEXTURES', false);

            // Enable production mode for better performance
            tf.enableProdMode();

            console.log('TensorFlow backend:', tf.getBackend());
            console.log('TensorFlow version:', tf.version.tfjs);

            return true;
        } catch (error) {
            console.error('Failed to initialize TensorFlow:', error);
            return false;
        }
    }

    /**
     * Get model configuration
     */
    getModelConfig() {
        return this.modelConfig;
    }

    /**
     * Get risk assessment thresholds
     */
    getRiskThresholds() {
        return this.riskThresholds;
    }

    /**
     * Get feature extraction configuration
     */
    getFeatureConfig() {
        return this.featureConfig;
    }

    /**
     * Create model architecture based on configuration
     */
    createModelArchitecture() {
        const layers = [];

        // Input layer
        layers.push(tf.layers.dense({
            inputShape: this.modelConfig.inputShape,
            units: this.modelConfig.hiddenLayers[0].units,
            activation: this.modelConfig.hiddenLayers[0].activation
        }));

        // Add dropout if specified
        if (this.modelConfig.hiddenLayers[0].dropout) {
            layers.push(tf.layers.dropout({
                rate: this.modelConfig.hiddenLayers[0].dropout
            }));
        }

        // Hidden layers
        for (let i = 1; i < this.modelConfig.hiddenLayers.length; i++) {
            const layerConfig = this.modelConfig.hiddenLayers[i];
            layers.push(tf.layers.dense({
                units: layerConfig.units,
                activation: layerConfig.activation
            }));
        }

        // Output layer
        layers.push(tf.layers.dense({
            units: this.modelConfig.outputUnits,
            activation: this.modelConfig.outputActivation
        }));

        return tf.sequential({ layers });
    }

    /**
     * Get compilation configuration
     */
    getCompilationConfig() {
        return {
            optimizer: this.modelConfig.optimizer,
            loss: this.modelConfig.loss,
            metrics: this.modelConfig.metrics
        };
    }

    /**
     * Get training configuration
     */
    getTrainingConfig() {
        return {
            batchSize: this.modelConfig.batchSize,
            epochs: this.modelConfig.epochs,
            validationSplit: this.modelConfig.validationSplit,
            verbose: 1,
            callbacks: [
                tf.callbacks.earlyStopping({
                    monitor: 'val_loss',
                    patience: 10,
                    restoreBestWeights: true
                })
            ]
        };
    }

    /**
     * Memory management utilities
     */
    cleanupMemory() {
        // Dispose of unused tensors
        const numTensors = tf.memory().numTensors;
        console.log(`Current tensor count: ${numTensors}`);

        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
    }

    /**
     * Get memory usage statistics
     */
    getMemoryStats() {
        return tf.memory();
    }
}

module.exports = new TensorFlowConfig();