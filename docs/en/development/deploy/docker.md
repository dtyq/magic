## Quick Start 🚀
Supports Mac OS and Linux operating systems. Windows systems can run through docker-compose.

### Avvio Rapido 🚀
Supporta i sistemi operativi Mac OS e Linux. I sistemi Windows possono essere eseguiti tramite docker-compose.

### 1. Clone the Project 📥
```bash
git clone https://github.com/dtyq/magic.git
cd magic
```

### 1. Clona il Progetto 📥
```bash
git clone https://github.com/dtyq/magic.git
cd magic
```

### 2. Configure Environment Variables ⚙️
Configure Magic environment variables. You must configure at least one large language model environment variable for proper functionality.
Copy the `.env.example` file to `.env` and modify the configuration as needed:
```bash
cp .env.example .env
```

### 2. Configura le Variabili d'Ambiente ⚙️
Configura le variabili d'ambiente di Magic. Devi configurare almeno una variabile d'ambiente per il modello di linguaggio di grandi dimensioni per il corretto funzionamento.
Copia il file `.env.example` in `.env` e modifica la configurazione come necessario:
```bash
cp .env.example .env
```

### 3. Start the Service ▶️

```bash
# Start the service in foreground
./bin/magic.sh start
```

### 3. Avvia il Servizio ▶️

```bash
# Avvia il servizio in primo piano
./bin/magic.sh start
```

### 4. Other Commands 🛠️

```bash
# Display help information
./bin/magic.sh help

# Start the service in foreground
./bin/magic.sh start

# Start the service in background
./bin/magic.sh daemon

# Stop the service
./bin/magic.sh stop

# Restart the service
./bin/magic.sh restart

# Check service status
./bin/magic.sh status

# View service logs
./bin/magic.sh logs
```

### 4. Altri Comandi 🛠️

```bash
# Visualizza le informazioni di aiuto
./bin/magic.sh help

# Avvia il servizio in primo piano
./bin/magic.sh start

# Avvia il servizio in background
./bin/magic.sh daemon

# Ferma il servizio
./bin/magic.sh stop

# Riavvia il servizio
./bin/magic.sh restart

# Controlla lo stato del servizio
./bin/magic.sh status

# Visualizza i log del servizio
./bin/magic.sh logs
```

### 4. Access Services 🌐
- API Service: http://localhost:9501
- Web Application: http://localhost:8080
  - Account `13812345678`：Password `letsmagic.ai`
  - Account `13912345678`：Password `letsmagic.ai`
- RabbitMQ Management Interface: http://localhost:15672
  - Username: admin
  - Password: magic123456

### 4. Accedi ai Servizi 🌐
- Servizio API: http://localhost:9501
- Applicazione Web: http://localhost:8080
  - Account `13812345678`：Password `letsmagic.ai`
  - Account `13912345678`：Password `letsmagic.ai`
- Interfaccia di Gestione RabbitMQ: http://localhost:15672
  - Nome utente: admin
  - Password: magic123456
