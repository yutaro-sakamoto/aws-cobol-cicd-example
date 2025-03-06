FROM nginx:alpine

# Nginxのデフォルト設定を上書き
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Hello Worldを表示するHTMLファイルを作成
RUN mkdir -p /usr/www/html
RUN echo "<html><body><h1>Hello World</h1></body></html>" > /usr/www/html/index.html

# ポート80を公開
EXPOSE 80

# Nginxを起動
CMD ["nginx", "-g", "daemon off;"]