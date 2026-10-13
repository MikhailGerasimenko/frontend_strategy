FROM docker.repo.severstal.severstalgroup.com/devops-public/corp-images/nginx:1.26.1-bookworm

WORKDIR /usr/share/nginx/html

COPY dist/ /usr/share/nginx/html
# server-блок слушает 8080 (как service/ingress); без этого образа default nginx на :80
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
