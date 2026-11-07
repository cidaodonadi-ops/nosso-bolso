

### Código Completo Atualizado com o Módulo de Autofinanciamento

```jsx
import React, { useState, useEffect, useMemo } from 'react';
import { 
  PlusCircle, Trash2, Moon, Sun, 
  PiggyBank, Plane, Wallet, Calculator, Settings, Mic, LogOut, Lock, Mail, RefreshCw, Repeat
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDeo0qlg76LOaUGMbqVwNZqLRURc1Qie5o",
  authDomain: "nosso-bolso-efd5a.firebaseapp.com",
  projectId: "nosso-bolso-efd5a",
  storageBucket: "nosso-bolso-efd5a.firebasestorage.app",
  messagingSenderId: "869567181107",
  appId: "1:869567181107:web:f4d1da08c2c766489ece46"
};

let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.log("Modo offline/demonstração ativado (configure o Firebase para nuvem)");
}

const CATEGORIAS_INICIAIS = [
  'Moradia (Aluguel/Condomínio)',
  'Mercado & Casa (Salário)',
  'Mercado & Casa (VA)',
  'Contas da Casa (Luz/Água/Net)',
  'Carro do Pequeno',
  'Carro da Pequena',
  'Carro (Uso Mútuo / Viagem)',
  'Gatos / Pets',
  'Alimentação / Delivery',
  'Vestuário & Cuidados',
  'Lazer & Superfaturados',
  'Saúde & Farmácia',
  'Autofinanciamento (Devolução)',
  'Férias / 13º / 1/3 (Viagens)',
  'Outros'
];

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [emailLogin, setEmailLogin] = useState('');
  const [senhaLogin, setSenhaLogin] = useState('');
  const [erroAuth, setErroAuth] = useState('');

  const [perfis, setPerfis] = useState({
    pequeno: { nome: 'Pequeno', salario: 6000, va: 800, metaInvestimento: 800 },
    pequena: { nome: 'Pequena', salario: 6000, va: 800, metaInvestimento: 800 }
  });

  const [categorias, setCategorias] = useState(CATEGORIAS_INICIAIS);
  const [novaCategoriaInput, setNovaCategoriaInput] = useState('');
  const [transacoes, setTransacoes] = useState([]);

  const [abaAtiva, setAbaAtiva] = useState('dashboard');
  const [modoEscuro, setModoEscuro] = useState(false);
  const [mesFiltro, setMesFiltro] = useState('2026-11');
  const [ouvindoVoz, setOuvindoVoz] = useState(false);

  const [form, setForm] = useState({
    descricao: '',
    valor: '',
    categoria: CATEGORIAS_INICIAIS[0],
    pagador: 'pequeno',
    tipoDivisao: '50/50',
    meioPagamento: 'salario',
    veiculo: 'nenhum',
    parcelas: 1,
    eAutofinanciamento: false,
    eReceita: false
  });

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!usuario || !db) {
      const saved = localStorage.getItem('nossobolso_transacoes');
      if (saved) setTransacoes(JSON.parse(saved));
      return;
    }

    async function carregarDadosNuvem() {
      try {
        const querySnapshot = await getDocs(collection(db, "transacoes"));
        const lista = [];
        querySnapshot.forEach((doc) => {
          lista.push({ id: doc.id, ...doc.data() });
        });
        setTransacoes(lista);
      } catch (e) {
        console.error("Erro ao carregar do Firestore", e);
      }
    }
    carregarDadosNuvem();
  }, [usuario]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErroAuth('');
    if (!auth) {
      setUsuario({ email: emailLogin });
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, emailLogin, senhaLogin);
    } catch (err) {
      try {
        await createUserWithEmailAndPassword(auth, emailLogin, senhaLogin);
      } catch (err2) {
        setErroAuth('Erro no login/cadastro. Verifique os dados.');
      }
    }
  };

  const handleLogout = async () => {
    if (auth) await signOut(auth);
    setUsuario(null);
  };

  const transacoesDoMes = useMemo(() => {
    return transacoes.filter(t => t.data && t.data.startsWith(mesFiltro));
  }, [transacoes, mesFiltro]);

  // Lista consolidada de Autofinanciamentos ativos
  const autofinanciamentos = useMemo(() => {
    return transacoes.filter(t => t.eAutofinanciamento);
  }, [transacoes]);

  const calculos = useMemo(() => {
    let gastosSalarioTotais = 0;
    let gastosPequenoSalario = 0;
    let gastosPequenaSalario = 0;
    let totalAutofinanciamentoMes = 0;
    
    let vaGastoPequeno = 0;
    let vaGastoPequena = 0;
    let pagoParaCasaPequeno = 0;
    let pagoParaCasaPequena = 0;
    let caixinhaViagens = 0;

    transacoes.forEach(t => {
      if (t.categoria && t.categoria.includes('Férias / 13º') && t.eReceita) {
        caixinhaViagens += Number(t.valor);
      }
    });

    transacoesDoMes.forEach(t => {
      if (t.eReceita) return;
      const valor = Number(t.valor);

      if (t.eAutofinanciamento) {
        totalAutofinanciamentoMes += valor;
      }

      if (t.meioPagamento === 'va') {
        if (t.pagador === 'pequeno') vaGastoPequeno += valor;
        if (t.pagador === 'pequena') vaGastoPequena += valor;
        return;
      }

      gastosSalarioTotais += valor;

      if (t.tipoDivisao === '50/50') {
        if (t.pagador === 'pequeno') pagoParaCasaPequeno += valor;
        if (t.pagador === 'pequena') pagoParaCasaPequena += valor;
        gastosPequenoSalario += valor / 2;
        gastosPequenaSalario += valor / 2;
      } else {
        if (t.pagador === 'pequeno') gastosPequenoSalario += valor;
        if (t.pagador === 'pequena') gastosPequenaSalario += valor;
      }
    });

    const metadeTotalCasa = (pagoParaCasaPequeno + pagoParaCasaPequena) / 2;
    const saldoPequenoCasa = pagoParaCasaPequeno - metadeTotalCasa; 

    const salarioPequeno = Number(perfis.pequeno.salario);
    const salarioPequena = Number(perfis.pequena.salario);
    const vaPequenoTotal = Number(perfis.pequeno.va);
    const vaPequenaTotal = Number(perfis.pequena.va);
    const metaPequeno = Number(perfis.pequeno.metaInvestimento);
    const metaPequena = Number(perfis.pequena.metaInvestimento);

    const orcamentoLivrePequeno = salarioPequeno - metaPequeno - gastosPequenoSalario;
    const orcamentoLivrePequena = salarioPequena - metaPequena - gastosPequenaSalario;

    return {
      gastosSalarioTotais,
      gastosPequenoSalario,
      gastosPequenaSalario,
      totalAutofinanciamentoMes,
      vaGastoPequeno,
      vaGastoPequena,
      vaRestantePequeno: vaPequenoTotal - vaGastoPequeno,
      vaRestantePequena: vaPequenaTotal - vaGastoPequena,
      pagoParaCasaPequeno,
      pagoParaCasaPequena,
      saldoPequenoCasa,
      caixinhaViagens,
      orcamentoLivrePequeno,
      orcamentoLivrePequena,
      metaPequeno,
      metaPequena
    };
  }, [transacoes, transacoesDoMes, perfis]);

  const handleAdicionarTransacao = async (e) => {
    e.preventDefault();
    if (!form.descricao || !form.valor) return;

    const numParcelas = Math.max(1, parseInt(form.parcelas) || 1);
    const valorTotal = parseFloat(form.valor);
    const valorParcela = valorTotal / numParcelas;

    const [ano, mes] = mesFiltro.split('-').map(Number);
    const novasTransacoes = [];
    const grupoId = `auto-${Date.now()}`;

    for (let i = 0; i < numParcelas; i++) {
      let dataParcela = new Date(ano, mes - 1 + i, 5);
      let strAno = dataParcela.getFullYear();
      let strMes = String(dataParcela.getMonth() + 1).padStart(2, '0');
      
      const novaT = {
        data: `${strAno}-${strMes}-05`,
        descricao: numParcelas > 1 ? `${form.descricao} (${i + 1}/${numParcelas})` : form.descricao,
        valor: valorParcela,
        categoria: form.eAutofinanciamento ? 'Autofinanciamento (Devolução)' : form.categoria,
        pagador: form.pagador,
        tipoDivisao: form.tipoDivisao,
        meioPagamento: form.meioPagamento,
        veiculo: form.veiculo,
        parcelas: numParcelas,
        parcelaAtual: i + 1,
        grupoId: form.eAutofinanciamento ? grupoId : null,
        valorTotalOriginal: valorTotal,
        eAutofinanciamento: form.eAutofinanciamento,
        eReceita: form.eReceita
      };

      if (db && usuario) {
        try {
          const docRef = await addDoc(collection(db, "transacoes"), novaT);
          novasTransacoes.push({ id: docRef.id, ...novaT });
        } catch (err) {
          console.error("Erro ao salvar no Firestore", err);
        }
      } else {
        novasTransacoes.push({ id: `${Date.now()}-${i}`, ...novaT });
      }
    }

    setTransacoes(prev => [...novasTransacoes, ...prev]);
    setForm({
      descricao: '',
      valor: '',
      categoria: categorias[0],
      pagador: 'pequeno',
      tipoDivisao: '50/50',
      meioPagamento: 'salario',
      veiculo: 'nenhum',
      parcelas: 1,
      eAutofinanciamento: false,
      eReceita: false
    });
  };

  const removerTransacao = async (id) => {
    if (db && usuario) {
      try {
        await deleteDoc(doc(db, "transacoes", id));
      } catch (err) {
        console.error("Erro ao deletar", err);
      }
    }
    setTransacoes(prev => prev.filter(t => t.id !== id));
  };

  if (!usuario) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl space-y-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-600 rounded-xl mx-auto flex items-center justify-center mb-3 shadow-lg">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold">NossoBolso</h1>
            <p className="text-xs text-slate-400 mt-1">Controle Financeiro do Casal</p>
          </div>

          {erroAuth && <div className="p-3 bg-rose-500/20 border border-rose-500 text-rose-300 text-xs rounded-lg">{erroAuth}</div>}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">E-mail de Acesso</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input 
                  type="email" required placeholder="casal@email.com"
                  value={emailLogin} onChange={(e) => setEmailLogin(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm rounded-lg bg-slate-700 border border-slate-600 text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input 
                  type="password" required placeholder="••••••••"
                  value={senhaLogin} onChange={(e) => setSenhaLogin(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm rounded-lg bg-slate-700 border border-slate-600 text-white"
                />
              </div>
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors shadow-md">
              Entrar ou Cadastrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${modoEscuro ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'} transition-colors duration-200 font-sans pb-12`}>
      <header className={`sticky top-0 z-50 ${modoEscuro ? 'bg-slate-800/90 border-slate-700' : 'bg-white/90 border-slate-200'} backdrop-blur-md border-b px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl text-white shadow-md">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">NossoBolso</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Pequeno & Pequena</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input 
            type="month" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)}
            className={`text-sm px-3 py-1.5 rounded-lg border font-medium ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
          />
          <button onClick={() => setModoEscuro(!modoEscuro)} className={`p-2 rounded-lg border ${modoEscuro ? 'bg-slate-700 border-slate-600 text-yellow-400' : 'bg-slate-100 border-slate-300 text-slate-600'}`}>
            {modoEscuro ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button onClick={handleLogout} className="p-2 rounded-lg border bg-rose-500/10 text-rose-500 border-rose-500/30 hover:bg-rose-500/20" title="Sair">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6">
        <nav className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-700 overflow-x-auto pb-2">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Wallet },
            { id: 'autofinanciamento', label: 'Autofinanciamento', icon: RefreshCw },
            { id: 'acerto', label: 'Acerto do Mês', icon: Calculator },
            { id: 'lancamentos', label: 'Lançamentos', icon: PlusCircle },
            { id: 'viagens', label: 'Caixinha Viagem', icon: Plane },
            { id: 'config', label: 'Configurações', icon: Settings }
          ].map(aba => {
            const Icon = aba.icon;
            const ativo = abaAtiva === aba.id;
            return (
              <button
                key={aba.id} onClick={() => setAbaAtiva(aba.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                  ativo ? 'bg-blue-600 text-white shadow-sm' : modoEscuro ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {aba.label}
              </button>
            );
          })}
        </nav>

        {abaAtiva === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-4 rounded-xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-sm`}>
                <p className="text-xs text-slate-500 font-medium">Gastos Totais (Via Salário)</p>
                <p className="text-2xl font-bold mt-1">R$ {calculos.gastosSalarioTotais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                {calculos.totalAutofinanciamentoMes > 0 && (
                  <span className="text-xs text-indigo-500 font-semibold mt-1 block">
                    (Inclui R$ {calculos.totalAutofinanciamentoMes.toFixed(2)} em devoluções para a poupança)
                  </span>
                )}
              </div>
              <div className={`p-4 rounded-xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-sm border-l-4 border-l-blue-500`}>
                <p className="text-xs text-blue-500 font-semibold">Valor Livre Pequeno (Real)</p>
                <p className="text-xl font-bold mt-1">R$ {calculos.orcamentoLivrePequeno.toFixed(2)}</p>
              </div>
              <div className={`p-4 rounded-xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-sm border-l-4 border-l-pink-500`}>
                <p className="text-xs text-pink-500 font-semibold">Valor Livre Pequena (Real)</p>
                <p className="text-xl font-bold mt-1">R$ {calculos.orcamentoLivrePequena.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* ABA: AUTOFINANCIAMENTO */}
        {abaAtiva === 'autofinanciamento' && (
          <div className="space-y-6">
            <div className={`p-6 rounded-2xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-md`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Painel de Autofinanciamento</h2>
                  <p className="text-xs text-slate-400">Compras pagas à vista com a reserva e devolvidas em parcelas para si mesmo.</p>
                </div>
              </div>

              {autofinanciamentos.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-6">Nenhum autofinanciamento registrado até o momento.</p>
              ) : (
                <div className="space-y-3 mt-4">
                  {autofinanciamentos.map(t => (
                    <div key={t.id} className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20 flex justify-between items-center">
                      <div>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-600 text-white mr-2">
                          {t.parcelaAtual}/{t.parcelas}x
                        </span>
                        <span className="font-semibold text-sm">{t.descricao}</span>
                        <p className="text-xs text-slate-500 mt-1">Pagador: {t.pagador === 'pequeno' ? 'Pequeno' : 'Pequena'} • Parcela: R$ {Number(t.valor).toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-indigo-500 font-semibold block">Devolução para Reserva</span>
                        <span className="font-bold text-sm text-indigo-600">R$ {Number(t.valor).toFixed(2)}/mês</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {abaAtiva === 'lancamentos' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className={`p-4 rounded-xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-sm h-fit`}>
              <h3 className="font-bold text-sm mb-4">Novo Gasto</h3>
              <form onSubmit={handleAdicionarTransacao} className="space-y-3">
                <input 
                  type="text" required placeholder="Descrição do Gasto"
                  value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value})}
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                />
                <input 
                  type="number" step="0.01" required placeholder="Valor Total (R$)"
                  value={form.valor} onChange={(e) => setForm({...form, valor: e.target.value})}
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                />
                
                {/* Opção de Autofinanciamento */}
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg border border-indigo-200 dark:border-indigo-900 flex items-center gap-2">
                  <input 
                    type="checkbox"
                    id="chkAuto"
                    checked={form.eAutofinanciamento}
                    onChange={(e) => setForm({...form, eAutofinanciamento: e.target.checked})}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <label htmlFor="chkAuto" className="text-xs font-semibold text-indigo-900 dark:text-indigo-200 cursor-pointer">
                    É Autofinanciamento? (Financiei de mim mesmo)
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={form.pagador} onChange={(e) => setForm({...form, pagador: e.target.value})}
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                  >
                    <option value="pequeno">Pequeno</option>
                    <option value="pequena">Pequena</option>
                  </select>
                  <input 
                    type="number" min="1" max="48" placeholder="Parcelas (Devolução)"
                    value={form.parcelas} onChange={(e) => setForm({...form, parcelas: e.target.value})}
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                  />
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg text-sm">Salvar Lançamento</button>
              </form>
            </div>

            <div className="md:col-span-2 space-y-3">
              <h3 className="font-bold text-sm text-slate-500">Lançamentos de {mesFiltro}</h3>
              {transacoesDoMes.map(t => (
                <div key={t.id} className={`p-3 rounded-xl border ${t.eAutofinanciamento ? 'border-indigo-400 bg-indigo-50/20' : modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} flex items-center justify-between`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${t.pagador === 'pequeno' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                        {t.pagador === 'pequeno' ? 'Pequeno' : 'Pequena'}
                      </span>
                      {t.eAutofinanciamento && (
                        <span className="text-xs px-2 py-0.5 rounded font-semibold bg-indigo-600 text-white flex items-center gap-1">
                          <Repeat className="w-3 h-3" /> Devolução Poupança ({t.parcelaAtual}/{t.parcelas})
                        </span>
                      )}
                      <span className="font-semibold text-sm">{t.descricao}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm">R$ {Number(t.valor).toFixed(2)}</span>
                    <button onClick={() => removerTransacao(t.id)} className="text-slate-400 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

```
