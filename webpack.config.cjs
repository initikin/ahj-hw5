const path = require('node:path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (_, argv) => ({
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'js/main.[contenthash:8].js',
    assetModuleFilename: 'images/[name].[contenthash:8][ext]',
    publicPath: 'auto',
    clean: true,
  },
  devtool: argv.mode === 'production' ? false : 'source-map',
  module: {
    rules: [
      { test: /\.js$/i, exclude: /node_modules/, use: 'babel-loader' },
      { test: /\.css$/i, use: [MiniCssExtractPlugin.loader, 'css-loader'] },
      { test: /\.(png|jpe?g|gif|svg)$/i, type: 'asset/resource' },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({ template: './src/index.html', favicon: './src/img/chat.svg' }),
    new MiniCssExtractPlugin({ filename: 'css/main.[contenthash:8].css' }),
    new webpack.EnvironmentPlugin({ CHAT_API_URL: 'http://localhost:3000/' }),
  ],
  devServer: { port: 8080, hot: true, open: false },
});
