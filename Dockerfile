FROM docker.repo.severstal.severstalgroup.com/devops-public/corp-images/nginx:1.26.1-bookworm

WORKDIR /usr/share/nginx/html

COPY dist/ /usr/share/nginx/html
# Полный nginx.conf (не только conf.d): listen 8080 + pid /tmp для non-root
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
