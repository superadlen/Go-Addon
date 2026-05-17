FROM node:18-slim

WORKDIR /app

# Copie des fichiers de dépendances
COPY package*.json ./

# Installation des modules (express, axios, cors, node-cache)
RUN npm install --production

# Copie de tout le code de Torrent♦️GT
COPY . .

# Exposition du port utilisé par ton script express
EXPOSE 3000

# Lancement du serveur
CMD ["node", "server.js"]
