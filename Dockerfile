FROM node:8.15.1-alpine
RUN mkdir /api
WORKDIR /api
COPY ./serviceAccount /
COPY ./*.js /
COPY package*.json ./
RUN npm install
EXPOSE 3000
CMD [ "npm", "start" ]