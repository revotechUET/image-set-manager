module.exports = {
	context: __dirname + '/src',
	mode: "development",
	entry: {
		main: "./index.js",
	},
	output: {
		// path: __dirname + '/../wi-angular/watch/bower_components/image-set-manager/dist',
		path: __dirname + '/dist',
		filename: 'image-set-manager.js'
	},
	module: {
		rules: [{
				test: /\.html$/,
				use: ['html-loader']
			}, {
				test: /\.css$/,
				use: ['style-loader', 'css-loader'],
			},
			{
				test: /\.less$/,
				use: ['style-loader','css-loader','less-loader'],
			}
		],
	},
}
