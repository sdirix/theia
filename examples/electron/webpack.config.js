/**
 * This file can be edited to customize webpack configuration.
 * To reset delete this file and rerun theia build again.
 */
// @ts-check
const config = require('./gen-webpack.config.js');

/**
 * Expose bundled modules on window.theia.moduleName namespace, e.g.
 * window['theia']['@theia/core/lib/common/uri'].
 * Such syntax can be used by external code, for instance, for testing.
config.module.rules.push({
    test: /\.js$/,
    loader: require.resolve('@theia/application-manager/lib/expose-loader')
}); */

// Set to true to extract CSS to separate file for secondary windows
const EXTRACT_CSS = false;

if (EXTRACT_CSS) {
    const MiniCssExtractPlugin = require("mini-css-extract-plugin");

    config.module.rules.push(
        {
            test: /\.css$/,
            use: [MiniCssExtractPlugin.loader, "css-loader"],
        });

    config.optimization = {
        splitChunks: {
            cacheGroups: {
                styles: {
                    name: "styles",
                    type: "css/mini-extract",
                    chunks: "all",
                    enforce: true,
                },
            },
        },
    };

    config.plugins.push(new MiniCssExtractPlugin({
        filename: "[name].css",
    }));
}

module.exports = config;
