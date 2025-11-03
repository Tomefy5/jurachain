const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: './src/index.tsx',
    output: {
        path: path.resolve(__dirname, 'public/dist'),
        filename: 'bundle.[contenthash].js',
        publicPath: '/dist/',
        clean: true,
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.jsx'],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.(png|svg|jpg|jpeg|gif)$/i,
                type: 'asset/resource',
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './public/app.html',
            filename: '../app.html',
            inject: 'body',
        }),
    ],
    devServer: {
        static: {
            directory: path.join(__dirname, 'public'),
        },
        compress: true,
        port: 3001,
        historyApiFallback: {
            rewrites: [
                {
                    from: /^\/api\/.*$/, to: function (context) {
                        return context.parsedUrl.pathname;
                    }
                },
                { from: /./, to: '/app.html' }
            ]
        },
        proxy: {
            '/api': 'http://localhost:3000',
            '/health': 'http://localhost:3000',
            '/metrics': 'http://localhost:3000',
        },
    },
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    devtool: process.env.NODE_ENV === 'production' ? 'source-map' : 'eval-source-map',
};