FROM docker.repo.severstal.severstalgroup.com/devops-public/corp-images/nginx:1.26.1-bookworm

WORKDIR /usr/share/nginx/html

COPY dist/ /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx","-g","daemon off;"]
