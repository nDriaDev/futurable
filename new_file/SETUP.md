# Setup Iniziale

## 📋 Passi per Completare il Setup

### 1. Copia i File Sorgente

I file sorgente devono essere copiati dai documenti forniti nella cartella `src/`.

#### File 1: src/FuturableTask.ts
Copia tutto il contenuto del **Documento 1** (FuturableTask.ts) in:
```
src/FuturableTask.ts
```

#### File 2: src/Futurable.ts  
Copia tutto il contenuto del **Documento 2** (Futurable.ts) in:
```
src/Futurable.ts
```

### 2. Installa le Dipendenze

```bash
npm install
```

### 3. Verifica l'Installazione

```bash
# Controlla che i pacchetti siano installati
npm list tsx typescript @types/node
```

### 4. Esegui i Test

```bash
# Tutti i test
npm test

# Con coverage
npm run test:coverage
```

## ✅ Verifica che Tutto Funzioni

Dovresti vedere output simile a:

```
▶ Futurable
  ▶ Constructor and Basic Operations
    ✔ should create a Futurable that resolves (2ms)
    ✔ should create a Futurable that rejects (1ms)
    ...
  ✔ Constructor and Basic Operations (45ms)
  ...
▶ tests passed! (350 test cases)
```

## 🔧 Fix Comuni

### Problema: "Cannot find module '../src/Futurable.js'"

**Soluzione**: Assicurati che i file sorgente siano in `src/` e che abbiano i contenuti completi dei documenti (non solo placeholder).

### Problema: "SyntaxError: Unexpected token 'export'"

**Soluzione**: Verifica che package.json contenga `"type": "module"`.

### Problema: Test timeout

**Soluzione**: Alcuni test potrebbero richiedere più tempo. Puoi aumentare il timeout con:
```bash
node --import tsx --test --test-timeout=60000 tests/**/*.test*.ts
```

## 📂 Struttura Finale

Dopo il setup completo, dovresti avere:

```
futurable-tests/
├── node_modules/          # (generato da npm install)
├── src/
│   ├── Futurable.ts       # ✅ Contenuto del Documento 2
│   └── FuturableTask.ts   # ✅ Contenuto del Documento 1
├── tests/
│   ├── Futurable.test.ts
│   ├── FuturableTask.test.ts
│   └── FuturableTask.test2.ts
├── package.json
├── tsconfig.json
├── tsconfig.test.json
├── README.md
└── SETUP.md
```

## 🎯 Prossimi Passi

1. ✅ Copia i file sorgente
2. ✅ `npm install`
3. ✅ `npm test`
4. 🎉 Goditi il 100% coverage!

## 💡 Tips

- Usa `npm run test:futurable` per testare solo Futurable
- Usa `npm run test:task` per testare solo FuturableTask  
- Aggiungi `--test-only` per eseguire solo test marcati con `.only()`
- Usa `--test-reporter=tap` per output TAP format

## 📊 Metriche Attese

- **Numero test**: ~350+
- **Tempo esecuzione**: 5-10 secondi
- **Coverage**: 100% su entrambe le classi
- **Success rate**: 100%
