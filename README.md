# 🚀 Janjacord

Um clone ultra-leve do Discord feito sob medida para computadores modestos/PCs fracos, com foco em baixíssimo consumo de memória RAM e CPU.

---

## ✨ Funcionalidades
- **Sistema de Identidade Sem @:** Apenas nome e hashtag única (ex: `fulaninho#001`). Várias pessoas podem ter o mesmo nome com tags distintas.
- **Servidores Privados e Canais:** Criação de servidores privados com canais de texto (`#geral`) e canais de voz (`🔊 Geral`).
- **Chamadas de Voz & WebRTC Nativo:** Baixa latência, detecção automática de voz e som de entrada/saída sintetizados via Web Audio API.
- **Compartilhamento de Tela & Presets Dinâmicos:**
  - 🥔 Modo Batata (480p @ 20fps)
  - ⚖️ Modo Balanceado (720p @ 30fps)
  - 🚀 Modo Gamer (1080p @ 60fps)
- **Assistir Streams Sob Demanda:** Escolha quando assistir a stream de um amigo, com controle de volume individual da transmissão e modo tela cheia.
- **Chat Privado (DM) & Convites:** Mensagens diretas, envio de anexos, colar prints com `Ctrl+V`, chamadas privadas com ringtone e envio de convites de servidor interativos com botões de *Aceitar* / *Recusar*.
- **Lista de Membros Lateral:** Visualização em tempo real dos membros do servidor (Online com status de chamada/stream e Offline).

---

## 🛠️ Tecnologias Utilizadas
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, WebRTC nativo.
- **Backend:** Node.js, Express, Socket.io, TypeScript (`tsx`).
- **Armazenamento:** Atomic JSON Database local (`server/data/janjacord.db.json`).

---

## 💻 Como Rodar em Outro Computador

### 1. Clonar o repositório
```bash
git clone https://github.com/SEU_USUARIO/janjacord.git
cd janjacord
```

### 2. Instalar as dependências
```bash
# Instalar dependências do servidor
cd server
npm install

# Instalar dependências do cliente
cd ../client
npm install
```

### 3. Iniciar o projeto
No Windows, basta dar dois cliques no arquivo:
```bash
iniciar.bat
```
Ou rodar manualmente em dois terminais:
```bash
# Terminal 1 (Backend)
cd server && npm run dev

# Terminal 2 (Frontend)
cd client && npm run dev
```

Abra no navegador em: `http://localhost:5173`
