import React, { useState, useEffect, useMemo } from 'react';
import { 
  PlusCircle, Trash2, Moon, Sun, 
  PiggyBank, Plane, Wallet, Settings, Mic, MicOff, LogOut, Lock, Mail, RefreshCw, Sparkles, PieChart, Users, CheckCircle2, AlertCircle, Utensils, Edit3, X, TrendingUp, Calendar, ArrowRightLeft, Filter
} from 'lucide-react';

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, setDoc, getDoc, updateDoc } from "firebase/firestore";

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
  console.log("Modo offline/demonstração ativado");
}

const CATEGORIAS_PADRAO = [
  'Moradia (Aluguel/Condomínio)',
  'Mercado & Casa (Salário)',
  'Mercado & Casa (VA)',
  'Contas da Casa (Luz/Água/Net)',
  'Carro',
  'Gatos / Pets',
  'Alimentação / Delivery',
  'Vestuário & Cuidados',
  'Lazer & Superfaturados',
  'Saúde & Farmácia',
  'Investimentos / Aportes',
  'Renda Extra / Serviços (Aporte)',
  'Autofinanciamento (Devolução)',
  'Férias / 13º / 1/3 (Viagens)',
  'Outros'
];

const formatarMoedaInput = (valor) => {
  if (!valor) return '';
  const numeroLimpo = String(valor).replace(/\D/g, '');
  if (!numeroLimpo) return '';
  const numeroFormatado = (Number(numeroLimpo) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return numeroFormatado;
};

const parseMoedaInput = (valorFormatado) => {
  if (!valorFormatado) return '';
  const limpo = String(valorFormatado).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  return limpo;
};

const arredondar2 = (valor) => {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
};

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [emailLogin, setEmailLogin] = useState('');
  const [senhaLogin, setSenhaLogin] = useState('');
  const [erroAuth, setErroAuth] = useState('');

  const [perfis, setPerfis] = useState({
    pequeno: { nome: 'Pequeno', salario: '6.000,00', va: '800,00', metaInvestimento: '800,00' },
    pequena: { nome: 'Pequena', salario: '6.000,00', va: '800,00', metaInvestimento: '800,00' }
  });

  const [categorias, setCategorias] = useState(() => {
    const salvo = localStorage.getItem('nossobolso_categorias');
    if (salvo) {
      const listaSalva = JSON.parse(salvo);
      if (!listaSalva.includes('Investimentos / Aportes')) listaSalva.push('Investimentos / Aportes');
      if (!listaSalva.includes('Renda Extra / Serviços (Aporte)')) listaSalva.push('Renda Extra / Serviços (Aporte)');
      if (!listaSalva.includes('Carro')) listaSalva.push('Carro');
      return listaSalva;
    }
    return CATEGORIAS_PADRAO;
  });

  const [novaCategoriaInput, setNovaCategoriaInput] = useState('');
  const [transacoes, setTransacoes] = useState([]);

  const [abaAtiva, setAbaAtiva] = useState('dashboard');
  const [modoVisualizacaoDashboard, setModoVisualizacaoDashboard] = useState('mes');
  const [statusAviso, setStatusAviso] = useState({ tipo: '', mensagem: '' });
  const [editandoTransacao, setEditandoTransacao] = useState(null);

  const [modoEscuro, setModoEscuro] = useState(() => {
    const temaSalvo = localStorage.getItem('nossobolso_tema');
    if (temaSalvo !== null) return temaSalvo === 'escuro';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [mesFiltro, setMesFiltro] = useState('2026-11');
  const [anoFiltro, setAnoFiltro] = useState('2026');
  const [filtroPessoa, setFiltroPessoa] = useState('todos');
  const [filtroCategoriaLancamentos, setFiltroCategoriaLancamentos] = useState('todas');
  const [ouvindoVoz, setOuvindoVoz] = useState(false);

  const pagadorSugerido = useMemo(() => {
    if (!usuario || !usuario.email) return 'pequeno';
    const emailStr = usuario.email.toLowerCase();
    if (emailStr.includes('pequena')) return 'pequena';
    return 'pequeno';
  }, [usuario]);

  const [form, setForm] = useState({
    descricao: '',
    valor: '',
    modoValor: 'fixo',
    categoria: CATEGORIAS_PADRAO[0],
    pagador: pagadorSugerido,
    tipoDivisao: 'individual',
    meioPagamento: 'salario',
    parcelas: 1,
    eAutofinanciamento: false,
    eReceita: false,
    mesCompetencia: '2026-11'
  });

  useEffect(() => {
    if (usuario && !editandoTransacao) {
      setForm(prev => ({ ...prev, pagador: pagadorSugerido }));
    }
  }, [usuario, pagadorSugerido]);

  const alternarTema = () => {
    setModoEscuro(prev => {
      const novoModo = !prev;
      localStorage.setItem('nossobolso_tema', novoModo ? 'escuro' : 'claro');
      return novoModo;
    });
  };

  const categoriasOrdenadas = useMemo(() => {
    return [...categorias].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [categorias]);

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

        const configDoc = await getDoc(doc(db, "configuracoes", "geral"));
        if (configDoc.exists()) {
          const dados = configDoc.data();
          if (dados.perfis) setPerfis(dados.perfis);
          if (dados.categorias && Array.isArray(dados.categorias)) {
            let catNuvem = dados.categorias;
            if (!catNuvem.includes('Investimentos / Aportes')) catNuvem.push('Investimentos / Aportes');
            if (!catNuvem.includes('Renda Extra / Serviços (Aporte)')) catNuvem.push('Renda Extra / Serviços (Aporte)');
            if (!catNuvem.includes('Carro')) catNuvem.push('Carro');
            setCategorias(catNuvem);
            localStorage.setItem('nossobolso_categorias', JSON.stringify(catNuvem));
          }
        }
      } catch (e) {
        console.error("Erro ao carregar do Firestore", e);
        setStatusAviso({
          tipo: 'erro',
          mensagem: 'Não foi possível carregar os dados da nuvem. Usando dados locais salvos.'
        });
      }
    }
    carregarDadosNuvem();
  }, [usuario]);

  const salvarConfiguracoesNaNuvem = async (novosPerfis, novasCategorias) => {
    localStorage.setItem('nossobolso_categorias', JSON.stringify(novasCategorias));
    
    if (db && usuario) {
      try {
        await setDoc(doc(db, "configuracoes", "geral"), {
          perfis: novosPerfis,
          categorias: novasCategorias
        }, { merge: true });
        
        setStatusAviso({
          tipo: 'sucesso',
          mensagem: 'Alterações salvas e sincronizadas com sucesso!'
        });
        setTimeout(() => setStatusAviso({ tipo: '', mensagem: '' }), 4000);
      } catch (err) {
        console.error("Erro ao salvar na nuvem", err);
        setStatusAviso({
          tipo: 'erro',
          mensagem: 'Falha ao sincronizar com a nuvem. Suas alterações foram salvas no aparelho.'
        });
      }
    } else {
      setStatusAviso({
        tipo: 'sucesso',
        mensagem: 'Alterações salvas no dispositivo com sucesso!'
      });
      setTimeout(() => setStatusAviso({ tipo: '', mensagem: '' }), 3000);
    }
  };

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
    return transacoes.filter(t => {
      const matchMes = t.mesCompetencia ? t.mesCompetencia === mesFiltro : (t.data && t.data.startsWith(mesFiltro));
      if (!matchMes) return false;
      if (filtroCategoriaLancamentos !== 'todas' && t.categoria !== filtroCategoriaLancamentos) return false;
      return true;
    });
  }, [transacoes, mesFiltro, filtroCategoriaLancamentos]);

  const transacoesDoMesFiltradasPorPessoa = useMemo(() => {
    return transacoesDoMes.filter(t => {
      if (filtroPessoa !== 'todos' && t.pagador !== filtroPessoa && t.tipoDivisao !== '50/50') return false;
      return true;
    });
  }, [transacoesDoMes, filtroPessoa]);

  const transacoesDoAno = useMemo(() => {
    return transacoes.filter(t => {
      const anoTransacao = t.mesCompetencia ? t.mesCompetencia.split('-')[0] : (t.data ? t.data.split('-')[0] : '');
      if (anoTransacao !== anoFiltro) return false;
      return true;
    });
  }, [transacoes, anoFiltro]);

  const transacoesDashboardAtivas = modoVisualizacaoDashboard === 'mes' ? transacoesDoMes : transacoesDoAno;

  const autofinanciamentos = useMemo(() => {
    return transacoes.filter(t => {
      if (!t.eAutofinanciamento) return false;
      if (filtroPessoa !== 'todos' && t.pagador !== filtroPessoa) return false;
      return true;
    });
  }, [transacoes, filtroPessoa]);

  const calculos = useMemo(() => {
    let gastosPequenoSalario = 0;
    let gastosPequenaSalario = 0;
    let totalAutofinanciamentoMes = 0;
    let caixinhaViagens = 0;
    let totalAlimentacaoConsolidado = 0;
    
    let totalInvestidoMes = 0;
    let investidoPequeno = 0;
    let investidoPequena = 0;
    let totalRendaExtraMes = 0;
    let rendaExtraPequeno = 0;
    let rendaExtraPequena = 0;
    
    let totalPagoPeloPequenoEm50_50 = 0;
    let totalPagoPelaPequenaEm50_50 = 0;

    let gastosPorCategoria = {};

    transacoes.forEach(t => {
      if (t.categoria && t.categoria.includes('Férias / 13º') && t.eReceita) {
        if (filtroPessoa === 'todos' || t.pagador === filtroPessoa) {
          caixinhaViagens += arredondar2(t.valor);
        }
      }
    });

    transacoesDoMes.forEach(t => {
      if (t.eReceita) return;
      const valor = arredondar2(t.valor);
      
      if (t.tipoDivisao === '50/50') {
        if (t.pagador === 'pequeno') {
          totalPagoPeloPequenoEm50_50 += valor;
        } else if (t.pagador === 'pequena') {
          totalPagoPelaPequenaEm50_50 += valor;
        }
      }
    });

    transacoesDashboardAtivas.forEach(t => {
      if (t.eReceita) return;
      const valorOriginal = arredondar2(t.valor);
      const cat = t.categoria || 'Outros';

      if (t.eAutofinanciamento) {
        totalAutofinanciamentoMes += valorOriginal;
      }

      if (cat.toLowerCase().includes('investimento') || cat.toLowerCase().includes('aporte')) {
        totalInvestidoMes += valorOriginal;
        if (t.pagador === 'pequeno') investidoPequeno += valorOriginal;
        if (t.pagador === 'pequena') investidoPequena += valorOriginal;
      }

      if (cat.toLowerCase().includes('renda extra') || cat.toLowerCase().includes('serviços')) {
        totalRendaExtraMes += valorOriginal;
        if (t.pagador === 'pequeno') rendaExtraPequeno += valorOriginal;
        if (t.pagador === 'pequena') rendaExtraPequena += valorOriginal;
      }

      let pesoNoOrcamentoPequeno = 0;
      let pesoNoOrcamentoPequena = 0;

      if (t.tipoDivisao === '50/50') {
        pesoNoOrcamentoPequeno = arredondar2(valorOriginal / 2);
        pesoNoOrcamentoPequena = arredondar2(valorOriginal / 2);
      } else {
        if (t.pagador === 'pequeno') pesoNoOrcamentoPequeno = valorOriginal;
        if (t.pagador === 'pequena') pesoNoOrcamentoPequena = valorOriginal;
      }

      let valorParaGraficoEstatisticas = 0;
      if (filtroPessoa === 'pequeno') {
        valorParaGraficoEstatisticas = pesoNoOrcamentoPequeno;
      } else if (filtroPessoa === 'pequena') {
        valorParaGraficoEstatisticas = pesoNoOrcamentoPequena;
      } else {
        valorParaGraficoEstatisticas = arredondar2(pesoNoOrcamentoPequeno + pesoNoOrcamentoPequena);
      }

      if (valorParaGraficoEstatisticas > 0) {
        gastosPorCategoria[cat] = arredondar2((gastosPorCategoria[cat] || 0) + valorParaGraficoEstatisticas);
      }

      if (
        cat.toLowerCase().includes('mercado') || 
        cat.toLowerCase().includes('alimentação') || 
        cat.toLowerCase().includes('delivery') ||
        cat.toLowerCase().includes('va')
      ) {
        totalAlimentacaoConsolidado += valorParaGraficoEstatisticas;
      }

      if (t.meioPagamento !== 'va') {
        gastosPequenoSalario += pesoNoOrcamentoPequeno;
        gastosPequenaSalario += pesoNoOrcamentoPequena;
      }
    });

    const salarioPequeno = Number(parseMoedaInput(perfis.pequeno.salario)) || 0;
    const salarioPequena = Number(parseMoedaInput(perfis.pequena.salario)) || 0;
    const metaPequeno = Number(parseMoedaInput(perfis.pequeno.metaInvestimento)) || 0;
    const metaPequena = Number(parseMoedaInput(perfis.pequena.metaInvestimento)) || 0;

    const fatorMultiplicador = modoVisualizacaoDashboard === 'ano' ? 12 : 1;

    const orcamentoLivrePequeno = arredondar2((salarioPequeno * fatorMultiplicador) - (metaPequeno * fatorMultiplicador) - gastosPequenoSalario);
    const orcamentoLivrePequena = arredondar2((salarioPequena * fatorMultiplicador) - (metaPequena * fatorMultiplicador) - gastosPequenaSalario);

    let gastosSalarioTotais = 0;
    if (filtroPessoa === 'pequeno') gastosSalarioTotais = gastosPequenoSalario;
    else if (filtroPessoa === 'pequena') gastosSalarioTotais = gastosPequenaSalario;
    else gastosSalarioTotais = arredondar2(gastosPequenoSalario + gastosPequenaSalario);

    const totalGasto5050Mes = arredondar2(totalPagoPeloPequenoEm50_50 + totalPagoPelaPequenaEm50_50);
    const parteIdealCadaUm = arredondar2(totalGasto5050Mes / 2);
    const saldoLiquidoPequeno = arredondar2(totalPagoPeloPequenoEm50_50 - parteIdealCadaUm); 

    return {
      gastosSalarioTotais: arredondar2(gastosSalarioTotais),
      gastosPequenoSalario: arredondar2(gastosPequenoSalario),
      gastosPequenaSalario: arredondar2(gastosPequenaSalario),
      totalAutofinanciamentoMes: arredondar2(totalAutofinanciamentoMes),
      caixinhaViagens: arredondar2(caixinhaViagens),
      orcamentoLivrePequeno,
      orcamentoLivrePequena,
      totalAlimentacaoConsolidado: arredondar2(totalAlimentacaoConsolidado),
      totalInvestidoMes: arredondar2(totalInvestidoMes),
      investidoPequeno: arredondar2(investidoPequeno),
      investidoPequena: arredondar2(investidoPequena),
      totalRendaExtraMes: arredondar2(totalRendaExtraMes),
      rendaExtraPequeno: arredondar2(rendaExtraPequeno),
      rendaExtraPequena: arredondar2(rendaExtraPequena),
      gastosPorCategoria,
      totalPagoPeloPequenoEm50_50: arredondar2(totalPagoPeloPequenoEm50_50),
      totalPagoPelaPequenaEm50_50: arredondar2(totalPagoPelaPequenaEm50_50),
      totalGasto5050Mes,
      saldoLiquidoPequeno
    };
  }, [transacoes, transacoesDoMes, transacoesDashboardAtivas, perfis, filtroPessoa, modoVisualizacaoDashboard]);

  const handleSalvarTransacao = async (e) => {
    e.preventDefault();
    const valorNumerico = arredondar2(parseFloat(parseMoedaInput(form.valor)));
    if (!form.descricao || isNaN(valorNumerico)) return;

    if (editandoTransacao) {
      let atualizarProximos = false;
      if (editandoTransacao.grupoId || editandoTransacao.parcelas > 1) {
        atualizarProximos = window.confirm(
          "Deseja aplicar esta alteração a este lançamento e a TODOS os próximos parcelamentos futuros deste grupo?"
        );
      }

      const dadosAtualizados = {
        descricao: form.descricao,
        valor: valorNumerico,
        categoria: form.categoria,
        pagador: form.pagador,
        tipoDivisao: form.tipoDivisao,
        meioPagamento: form.meioPagamento,
        mesCompetencia: form.mesCompetencia
      };

      if (atualizarProximos && editandoTransacao.grupoId) {
        const idGrupo = editandoTransacao.grupoId;
        const parcelaRef = editandoTransacao.parcelaAtual || 1;

        setTransacoes(prev => prev.map(t => {
          if (t.grupoId === idGrupo && (t.parcelaAtual >= parcelaRef || !t.parcelaAtual)) {
            if (db && usuario) {
              updateDoc(doc(db, "transacoes", t.id), {
                ...dadosAtualizados,
                descricao: t.parcelas > 1 ? `${form.descricao} (${t.parcelaAtual}/${t.parcelas})` : form.descricao
              }).catch(err => console.error(err));
            }
            return {
              ...t,
              ...dadosAtualizados,
              descricao: t.parcelas > 1 ? `${form.descricao} (${t.parcelaAtual}/${t.parcelas})` : form.descricao
            };
          }
          return t;
        }));
      } else {
        if (db && usuario) {
          try {
            await updateDoc(doc(db, "transacoes", editandoTransacao.id), dadosAtualizados);
          } catch (err) {
            console.error("Erro ao atualizar no Firestore", err);
          }
        }
        setTransacoes(prev => prev.map(t => t.id === editandoTransacao.id ? { ...t, ...dadosAtualizados } : t));
      }

      setEditandoTransacao(null);
    } else {
      const numParcelas = Math.max(1, parseInt(form.parcelas) || 1);
      const valorParcela = form.modoValor === 'fixo' 
        ? valorNumerico 
        : arredondar2(valorNumerico / numParcelas);

      const [anoBase, mesBase] = form.mesCompetencia.split('-').map(Number);
      const novasTransacoes = [];
      const grupoId = `grupo-${Date.now()}`;

      for (let i = 0; i < numParcelas; i++) {
        let dataParcela = new Date(anoBase, mesBase - 1 + i, 5);
        let strAno = dataParcela.getFullYear();
        let strMes = String(dataParcela.getMonth() + 1).padStart(2, '0');
        let competenciaParcela = `${strAno}-${strMes}`;
        
        const novaT = {
          data: `${strAno}-${strMes}-05`,
          mesCompetencia: competenciaParcela,
          descricao: numParcelas > 1 ? `${form.descricao} (${i + 1}/${numParcelas})` : form.descricao,
          valor: valorParcela,
          categoria: form.eAutofinanciamento ? 'Autofinanciamento (Devolução)' : form.categoria,
          pagador: form.pagador,
          tipoDivisao: form.tipoDivisao,
          meioPagamento: form.meioPagamento,
          parcelas: numParcelas,
          parcelaAtual: i + 1,
          grupoId: numParcelas > 1 || form.eAutofinanciamento ? grupoId : null,
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
    }

    // Reset rigoroso do formulário com padrão Individual (100%)
    setForm({
      descricao: '',
      valor: '',
      modoValor: 'fixo',
      categoria: categoriasOrdenadas[0] || '',
      pagador: pagadorSugerido,
      tipoDivisao: 'individual',
      meioPagamento: 'salario',
      parcelas: 1,
      eAutofinanciamento: false,
      eReceita: false,
      mesCompetencia: mesFiltro
    });
  };

  const iniciarEdicaoTransacao = (t) => {
    setEditandoTransacao(t);
    const descLimpa = t.descricao.replace(/\s*\(\d+\/\d+\)$/, '');
    
    setForm({
      descricao: descLimpa,
      valor: formatarMoedaInput(String(Math.round(t.valor * 100))),
      modoValor: 'fixo',
      categoria: t.categoria,
      pagador: t.pagador || pagadorSugerido,
      tipoDivisao: t.tipoDivisao || 'individual',
      meioPagamento: t.meioPagamento || 'salario',
      parcelas: t.parcelas || 1,
      eAutofinanciamento: t.eAutofinanciamento || false,
      eReceita: t.eReceita || false,
      mesCompetencia: t.mesCompetencia || mesFiltro
    });
  };

  const cancelarEdicao = () => {
    setEditandoTransacao(null);
    setForm({
      descricao: '',
      valor: '',
      modoValor: 'fixo',
      categoria: categoriasOrdenadas[0] || '',
      pagador: pagadorSugerido,
      tipoDivisao: 'individual',
      meioPagamento: 'salario',
      parcelas: 1,
      eAutofinanciamento: false,
      eReceita: false,
      mesCompetencia: mesFiltro
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
    if (editandoTransacao?.id === id) cancelarEdicao();
  };

  const adicionarCategoria = (e) => {
    e.preventDefault();
    if (!novaCategoriaInput.trim()) return;
    const nomeFormatado = novaCategoriaInput.trim();
    if (!categorias.includes(nomeFormatado)) {
      const novas = [...categorias, nomeFormatado];
      setCategorias(novas);
      salvarConfiguracoesNaNuvem(perfis, novas);
    }
    setNovaCategoriaInput('');
  };

  const removerCategoria = (catRemover) => {
    const novas = categorias.filter(c => c !== catRemover);
    setCategorias(novas);
    salvarConfiguracoesNaNuvem(perfis, novas);
  };

  const iniciarReconhecimentoVoz = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Seu navegador não suporta reconhecimento de voz.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setOuvindoVoz(true);
    recognition.onend = () => setOuvindoVoz(false);
    recognition.onerror = () => setOuvindoVoz(false);

    recognition.onresult = (event) => {
      const texto = event.results[0][0].transcript.toLowerCase();
      const matchValor = texto.match(/(\d+)(?:\s*(?:reais|real))?/);
      let valorExtraido = matchValor ? matchValor[1] : '';

      let pagadorExtraido = pagadorSugerido;
      if (texto.includes('pequena')) pagadorExtraido = 'pequena';
      if (texto.includes('pequeno')) pagadorExtraido = 'pequeno';

      setForm(prev => ({
        ...prev,
        descricao: event.results[0][0].transcript,
        valor: valorExtraido ? formatarMoedaInput(valorExtraido + '00') : prev.valor,
        pagador: pagadorExtraido
      }));
    };

    recognition.start();
  };

  if (!usuario) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 bg-gradient-to-tr from-cyan-500 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center mb-3 shadow-lg shadow-cyan-500/20">
              <Sparkles className="w-7 h-7 text-white"/>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">NossoBolso</h1>
            <p className="text-xs text-slate-400 mt-1">Controle Financeiro Inteligente do Casal</p>
          </div>

          {erroAuth && <div className="p-3 bg-rose-500/20 border border-rose-500 text-rose-300 text-xs rounded-lg">{erroAuth}</div>}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">E-mail de Acesso</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3"/>
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
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3"/>
                <input 
                  type="password" required placeholder="••••••••"
                  value={senhaLogin} onChange={(e) => setSenhaLogin(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm rounded-lg bg-slate-700 border border-slate-600 text-white"
                />
              </div>
            </div>

            <button type="submit" className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold py-2.5 rounded-lg text-sm transition-all shadow-lg shadow-blue-500/25">
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
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-cyan-500 to-indigo-600 rounded-xl text-white shadow-md shadow-cyan-500/20">
            <Sparkles className="w-5 h-5"/>
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">NossoBolso</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Logado como: <span className="font-semibold capitalize">{pagadorSugerido}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {abaAtiva === 'dashboard' ? (
            modoVisualizacaoDashboard === 'mes' ? (
              <input 
                type="month" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)}
                className={`text-sm px-3 py-1.5 rounded-lg border font-medium ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
              />
            ) : (
              <select 
                value={anoFiltro} onChange={(e) => setAnoFiltro(e.target.value)}
                className={`text-sm px-3 py-1.5 rounded-lg border font-medium ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
              >
                <option value="2025">Ano 2025</option>
                <option value="2026">Ano 2026</option>
                <option value="2027">Ano 2027</option>
              </select>
            )
          ) : (
            <input 
              type="month" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)}
              className={`text-sm px-3 py-1.5 rounded-lg border font-medium ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
            />
          )}

          <button onClick={alternarTema} className={`p-2 rounded-lg border ${modoEscuro ? 'bg-slate-700 border-slate-600 text-yellow-400' : 'bg-slate-100 border-slate-300 text-slate-600'}`} title={modoEscuro ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}>
            {modoEscuro ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
          </button>
          <button onClick={handleLogout} className="p-2 rounded-lg border bg-rose-500/10 text-rose-500 border-rose-500/30 hover:bg-rose-500/20" title="Sair">
            <LogOut className="w-4 h-4"/>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6">
        <div className={`p-3 rounded-xl border mb-6 flex items-center justify-between shadow-sm ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-500"/>
            <span className="text-xs font-semibold text-slate-500">Visualizar por:</span>
          </div>
          <div className="flex gap-1.5">
            {[
              { id: 'todos', label: 'Casal (Ambos)' },
              { id: 'pequeno', label: 'Pequeno' },
              { id: 'pequena', label: 'Pequena' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFiltroPessoa(f.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filtroPessoa === f.id 
                    ? 'bg-cyan-600 text-white shadow-sm' 
                    : modoEscuro ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <nav className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-700 overflow-x-auto pb-2">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Wallet },
            { id: 'autofinanciamento', label: 'Autofinanciamento', icon: RefreshCw },
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
                <Icon className="w-4 h-4"/>
                {aba.label}
              </button>
            );
          })}
        </nav>

        {abaAtiva === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-slate-200 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-300 dark:border-slate-700">
              <div className="flex items-center gap-2 px-2">
                <Calendar className="w-4 h-4 text-cyan-500"/>
                <span className="text-xs font-bold">Período de Análise do Dashboard:</span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setModoVisualizacaoDashboard('mes')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    modoVisualizacaoDashboard === 'mes'
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Visão Mensal ({mesFiltro})
                </button>
                <button
                  onClick={() => setModoVisualizacaoDashboard('ano')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    modoVisualizacaoDashboard === 'ano'
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Visão Anual ({anoFiltro})
                </button>
              </div>
            </div>

            {/* Painel de Reembolso / Acerto de Contas 50/50 */}
            <div className={`p-5 rounded-2xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-md space-y-3 border-l-4 border-l-cyan-500`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-cyan-100 text-cyan-600 rounded-xl">
                    <ArrowRightLeft className="w-6 h-6"/>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Balanço de Acerto de Contas (Devolução 50/50)</h3>
                    <p className="text-xs text-slate-400">Reembolsos calculados exclusivamente para os gastos marcados como 50/50.</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Total Compartilhado ({mesFiltro})</span>
                  <span className="text-sm font-bold">R$ {calculos.totalGasto5050Mes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-4 ${modoEscuro ? 'bg-slate-700/40 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400 block">Resumo dos Pagamentos 50/50 no mês:</span>
                  <p className="text-xs">• Pago pelo Pequeno: <strong>R$ {calculos.totalPagoPeloPequenoEm50_50.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
                  <p className="text-xs">• Pago pela Pequena: <strong>R$ {calculos.totalPagoPelaPequenaEm50_50.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
                </div>

                <div className="text-right border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-6 border-slate-300 dark:border-slate-600 w-full md:w-auto">
                  {calculos.saldoLiquidoPequeno > 0 ? (
                    <div>
                      <span className="text-[10px] font-semibold text-pink-500 block uppercase">Reembolso Devido</span>
                      <span className="text-base font-bold text-pink-600">Pequena deve depositar R$ {calculos.saldoLiquidoPequeno.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ao Pequeno</span>
                    </div>
                  ) : calculos.saldoLiquidoPequeno < 0 ? (
                    <div>
                      <span className="text-[10px] font-semibold text-cyan-500 block uppercase">Reembolso Devido</span>
                      <span className="text-base font-bold text-cyan-600">Pequeno deve depositar R$ {Math.abs(calculos.saldoLiquidoPequeno).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} à Pequena</span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-[10px] font-semibold text-emerald-500 block uppercase">Contas Acertadas</span>
                      <span className="text-sm font-bold text-emerald-600">Nenhum reembolso pendente neste mês!</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className={`p-4 rounded-xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-sm`}>
                <p className="text-xs text-slate-500 font-medium">Gastos Totais ({modoVisualizacaoDashboard === 'mes' ? 'Mês' : 'Ano'})</p>
                <p className="text-xl font-bold mt-1">R$ {calculos.gastosSalarioTotais.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className={`p-4 rounded-xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-sm border-l-4 border-l-amber-500`}>
                <p className="text-xs text-amber-500 font-semibold flex items-center gap-1"><Utensils className="w-3.5 h-3.5"/> Total Alimentação</p>
                <p className="text-xl font-bold mt-1">R$ {calculos.totalAlimentacaoConsolidado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className={`p-4 rounded-xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-sm border-l-4 border-l-cyan-500`}>
                <p className="text-xs text-cyan-500 font-semibold">Valor Livre Pequeno</p>
                <p className="text-lg font-bold mt-1">R$ {calculos.orcamentoLivrePequeno.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className={`p-4 rounded-xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-sm border-l-4 border-l-pink-500`}>
                <p className="text-xs text-pink-500 font-semibold">Valor Livre Pequena</p>
                <p className="text-lg font-bold mt-1">R$ {calculos.orcamentoLivrePequena.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>

            {/* Painel de Investimentos e Renda Extra Aportada */}
            <div className={`p-5 rounded-2xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-md space-y-4 border-l-4 border-l-emerald-500`}>
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                    <PiggyBank className="w-6 h-6"/>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Reserva / Investimentos Realizados ({modoVisualizacaoDashboard === 'mes' ? mesFiltro : `Ano ${anoFiltro}`})</h3>
                    <p className="text-xs text-slate-400">Total guardado via aportes + renda extra de serviços no período.</p>
                  </div>
                </div>
                <div className="flex gap-4 text-right">
                  <div>
                    <span className="text-[10px] text-cyan-500 font-semibold block uppercase">Pequeno</span>
                    <span className="text-sm font-bold">R$ {(calculos.investidoPequeno + calculos.rendaExtraPequeno).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="border-l pl-4 border-slate-300 dark:border-slate-700">
                    <span className="text-[10px] text-pink-500 font-semibold block uppercase">Pequena</span>
                    <span className="text-sm font-bold">R$ {(calculos.investidoPequena + calculos.rendaExtraPequena).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="border-l pl-4 border-slate-300 dark:border-slate-700">
                    <span className="text-[10px] text-emerald-500 font-semibold block uppercase">Total Guardado</span>
                    <span className="text-base font-bold text-emerald-600">R$ {(calculos.totalInvestidoMes + calculos.totalRendaExtraMes).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {calculos.totalRendaExtraMes > 0 && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                  <span className="text-emerald-500 font-semibold flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5"/> Inclui Renda Extra / Serviços (Aporte):
                  </span>
                  <span className="font-bold text-emerald-600">+ R$ {calculos.totalRendaExtraMes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>

            {/* Gráfico Visual Percentual de Categorias */}
            <div className={`p-6 rounded-2xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-md space-y-4`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-cyan-500"/>
                  <h3 className="font-bold text-base">Distribuição Percentual de Gastos por Categoria ({modoVisualizacaoDashboard === 'mes' ? mesFiltro : `Ano ${anoFiltro}`})</h3>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-500">
                  Total: R$ {calculos.gastosSalarioTotais.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {Object.keys(calculos.gastosPorCategoria).length === 0 ? (
                <p className="text-xs text-slate-400 italic py-6 text-center">Nenhum gasto registrado para este período com o filtro selecionado.</p>
              ) : (
                <div className="space-y-4">
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-4 rounded-full overflow-hidden flex shadow-inner">
                    {Object.entries(calculos.gastosPorCategoria).map(([cat, val], idx) => {
                      const porcentagem = calculos.gastosSalarioTotais > 0 ? (val / calculos.gastosSalarioTotais) * 100 : 0;
                      if (porcentagem <= 0) return null;
                      const cores = [
                        'bg-cyan-500', 'bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 
                        'bg-pink-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 
                        'bg-teal-500', 'bg-violet-500', 'bg-fuchsia-500'
                      ];
                      const corClasse = cores[idx % cores.length];
                      return (
                        <div 
                          key={cat}
                          className={`${corClasse} h-full transition-all duration-500 hover:opacity-90`}
                          style={{ width: `${porcentagem}%` }}
                          title={`${cat}: R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${porcentagem.toFixed(1)}%)`}
                        ></div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {Object.entries(calculos.gastosPorCategoria).sort((a, b) => b[1] - a[1]).map(([cat, val], idx) => {
                      const porcentagem = calculos.gastosSalarioTotais > 0 ? (val / calculos.gastosSalarioTotais) * 100 : 0;
                      return (
                        <div key={cat} className={`p-3 rounded-xl border flex items-center justify-between ${modoEscuro ? 'bg-slate-700/30 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block" style={{ opacity: Math.max(0.4, 1 - (idx * 0.05)) }}></span>
                            <span className="text-xs font-semibold">{cat}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold block">R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span className="text-[10px] text-cyan-500 font-semibold">{porcentagem.toFixed(1)}% do total</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {abaAtiva === 'autofinanciamento' && (
          <div className="space-y-6">
            <div className={`p-6 rounded-2xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-md`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                  <RefreshCw className="w-6 h-6"/>
                </div>
                <div>
                  <h2 className="text-lg font-bold">Painel de Autofinanciamento</h2>
                  <p className="text-xs text-slate-400">Compras pagas à vista com a reserva e devolvidas em parcelas para si mesmo.</p>
                </div>
              </div>

              {autofinanciamentos.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-6">Nenhum autofinanciamento registrado para o filtro selecionado.</p>
              ) : (
                <div className="space-y-3 mt-4">
                  {autofinanciamentos.map(t => (
                    <div key={t.id} className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20 flex justify-between items-center">
                      <div>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-600 text-white mr-2">
                          {t.parcelaAtual}/{t.parcelas}x
                        </span>
                        <span className="font-semibold text-sm">{t.descricao}</span>
                        <p className="text-xs text-slate-500 mt-1">Competência: {t.mesCompetencia} • Pagador: {t.pagador}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-indigo-500 font-semibold block">Devolução para Reserva</span>
                        <span className="font-bold text-sm text-indigo-600">R$ {Number(t.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {abaAtiva === 'viagens' && (
          <div className={`p-6 rounded-2xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-md`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                <Plane className="w-6 h-6"/>
              </div>
              <div>
                <h2 className="text-lg font-bold">Caixinha de Viagem / Férias</h2>
                <p className="text-xs text-slate-400">Acúmulo de reservas para viagens e 13º/férias.</p>
              </div>
            </div>
            <p className="text-xl font-bold text-emerald-600 mt-4">Total Acumulado: R$ {calculos.caixinhaViagens.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        )}

        {abaAtiva === 'config' && (
          <div className="space-y-6">
            {statusAviso.mensagem && (
              <div className={`p-4 rounded-xl border text-xs flex items-center justify-between shadow-md ${
                statusAviso.tipo === 'sucesso' 
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200' 
                  : 'bg-amber-500/20 border-amber-500 text-amber-200'
              }`}>
                <div className="flex items-center gap-2">
                  {statusAviso.tipo === 'sucesso' ? <CheckCircle2 className="w-4 h-4 text-emerald-400"/> : <AlertCircle className="w-4 h-4 text-amber-400"/>}
                  <span>{statusAviso.mensagem}</span>
                </div>
                {statusAviso.tipo === 'erro' && (
                  <button 
                    onClick={() => salvarConfiguracoesNaNuvem(perfis, categorias)}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition-all"
                  >
                    Tentar novamente
                  </button>
                )}
              </div>
            )}

            <div className={`p-6 rounded-2xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-md space-y-4`}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-500"/> Parâmetros de Salários e VA
                </h2>
                <button 
                  onClick={() => salvarConfiguracoesNaNuvem(perfis, categorias)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg text-sm shadow-md transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4"/> Salvar Parâmetros
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['pequeno', 'pequena'].map((perfilKey) => {
                  const p = perfis[perfilKey];
                  return (
                    <div key={perfilKey} className={`p-4 rounded-xl border ${perfilKey === 'pequeno' ? 'border-cyan-200 bg-cyan-50/20' : 'border-pink-200 bg-pink-50/25'} space-y-3`}>
                      <h3 className={`font-bold text-sm capitalize ${perfilKey === 'pequeno' ? 'text-cyan-600' : 'text-pink-600'}`}>Perfil {p.nome}</h3>
                      <div>
                        <label className="text-xs text-slate-500 block">Salário (R$)</label>
                        <input 
                          type="text" value={p.salario}
                          onChange={(e) => {
                            const val = formatarMoedaInput(e.target.value);
                            setPerfis({
                              ...perfis,
                              [perfilKey]: { ...p, salario: val }
                            });
                          }}
                          className={`w-full px-3 py-1.5 text-sm rounded-lg border ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block">VA (R$)</label>
                        <input 
                          type="text" value={p.va}
                          onChange={(e) => {
                            const val = formatarMoedaInput(e.target.value);
                            setPerfis({
                              ...perfis,
                              [perfilKey]: { ...p, va: val }
                            });
                          }}
                          className={`w-full px-3 py-1.5 text-sm rounded-lg border ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block">Meta de Investimento / Reserva (R$)</label>
                        <input 
                          type="text" value={p.metaInvestimento}
                          onChange={(e) => {
                            const val = formatarMoedaInput(e.target.value);
                            setPerfis({
                              ...perfis,
                              [perfilKey]: { ...p, metaInvestimento: val }
                            });
                          }}
                          className={`w-full px-3 py-1.5 text-sm rounded-lg border ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`p-6 rounded-2xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-md space-y-4`}>
              <h2 className="text-lg font-bold">Classes / Categorias de Gastos (Ordem Alfabética)</h2>
              <p className="text-xs text-slate-400">Adicionar ou remover categorias atualiza e sincroniza instantaneamente na nuvem.</p>
              
              <form onSubmit={adicionarCategoria} className="flex gap-2">
                <input 
                  type="text" placeholder="Nome da nova categoria..."
                  value={novaCategoriaInput} onChange={(e) => setNovaCategoriaInput(e.target.value)}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                />
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                  Adicionar
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4 max-h-60 overflow-y-auto">
                {categoriasOrdenadas.map(cat => (
                  <div key={cat} className={`flex justify-between items-center p-2.5 rounded-lg border ${modoEscuro ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-sm font-medium">{cat}</span>
                    <button onClick={() => removerCategoria(cat)} className="text-slate-400 hover:text-rose-500 p-1" title="Excluir categoria">
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {abaAtiva === 'lancamentos' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className={`p-4 rounded-xl border ${editandoTransacao ? 'border-amber-500 bg-amber-500/5' : modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-sm h-fit space-y-4`}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm flex items-center gap-1.5">
                  {editandoTransacao ? <Edit3 className="w-4 h-4 text-amber-500"/> : <PlusCircle className="w-4 h-4 text-cyan-500"/>}
                  {editandoTransacao ? 'Editando Lançamento' : 'Novo Gasto'}
                </h3>
                {editandoTransacao ? (
                  <button 
                    type="button" 
                    onClick={cancelarEdicao}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-500/10 text-slate-400 hover:bg-slate-500/20"
                  >
                    <X className="w-3.5 h-3.5"/> Cancelar
                  </button>
                ) : (
                  <button 
                    type="button" 
                    onClick={iniciarReconhecimentoVoz}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      ouvindoVoz ? 'bg-rose-500 text-white animate-pulse' : 'bg-cyan-500/10 text-cyan-600 border border-cyan-500/30 hover:bg-cyan-500/20'
                    }`}
                    title="Falar gasto por voz"
                  >
                    {ouvindoVoz ? <MicOff className="w-3.5 h-3.5"/> : <Mic className="w-3.5 h-3.5"/>}
                    {ouvindoVoz ? 'Ouvindo...' : 'Falar Gasto'}
                  </button>
                )}
              </div>

              <form onSubmit={handleSalvarTransacao} className="space-y-3">
                <input 
                  type="text" required placeholder="Descrição (ex: Aluguel, Mercado...)"
                  value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value})}
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                />
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Como informar o valor?</label>
                    <select
                      value={form.modoValor}
                      onChange={(e) => setForm({...form, modoValor: e.target.value})}
                      className={`w-full px-3 py-2 text-sm rounded-lg border font-semibold ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                    >
                      <option value="fixo">Valor Fixo Mensal</option>
                      <option value="dividir">Valor Total (Dividir)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      {form.modoValor === 'fixo' ? 'Valor p/ Mês (R$)' : 'Valor Total (R$)'}
                    </label>
                    <input 
                      type="text" required placeholder="0,00"
                      value={form.valor} 
                      onChange={(e) => {
                        const formatado = formatarMoedaInput(e.target.value);
                        setForm({...form, valor: formatado});
                      }}
                      className={`w-full px-3 py-2 text-sm rounded-lg border ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Mês de Competência</label>
                  <input 
                    type="month"
                    value={form.mesCompetencia}
                    onChange={(e) => setForm({...form, mesCompetencia: e.target.value})}
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                  />
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Categoria / Classe</label>
                  <select
                    value={form.categoria} onChange={(e) => setForm({...form, categoria: e.target.value})}
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                  >
                    {categoriasOrdenadas.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Quem Pagou? (Sugerido)</label>
                    <select
                      value={form.pagador} onChange={(e) => setForm({...form, pagador: e.target.value})}
                      className={`w-full px-3 py-2 text-sm rounded-lg border font-semibold ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                    >
                      <option value="pequeno">Pequeno</option>
                      <option value="pequena">Pequena</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Divisão</label>
                    <select
                      value={form.tipoDivisao} onChange={(e) => setForm({...form, tipoDivisao: e.target.value})}
                      className={`w-full px-3 py-2 text-sm rounded-lg border font-semibold ${form.tipoDivisao === '50/50' ? 'border-amber-500 text-amber-500' : ''} ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                    >
                      <option value="individual">Individual (100%)</option>
                      <option value="50/50">Dividir 50/50 (Exceção)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    {form.modoValor === 'fixo' ? 'Repetir por quantos meses?' : 'Quantidade de Parcelas'}
                  </label>
                  <input 
                    type="number" min="1" max="48" disabled={editandoTransacao !== null}
                    value={form.parcelas} onChange={(e) => setForm({...form, parcelas: e.target.value})}
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${editandoTransacao !== null ? 'opacity-50 cursor-not-allowed' : ''} ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                  />
                </div>

                <button type="submit" className={`w-full font-semibold py-2.5 rounded-lg text-sm shadow-md transition-colors text-white ${editandoTransacao ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {editandoTransacao ? 'Atualizar Lançamento' : 'Salvar Lançamento'}
                </button>
              </form>
            </div>

            <div className="md:col-span-2 space-y-4">
              {/* Barra de Filtros de Categoria para os Lançamentos do Mês */}
              <div className={`p-3 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-sm`}>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Filter className="w-4 h-4 text-cyan-500 shrink-0"/>
                  <span className="text-xs font-bold text-slate-500">Filtrar Categoria:</span>
                </div>
                <select
                  value={filtroCategoriaLancamentos}
                  onChange={(e) => setFiltroCategoriaLancamentos(e.target.value)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-semibold w-full sm:w-64 ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-300'}`}
                >
                  <option value="todas">Todas as Categorias</option>
                  {categoriasOrdenadas.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-500">Lançamentos de Competência: {mesFiltro}</h3>
                <span className="text-xs font-semibold text-slate-400">Total filtrado: {transacoesDoMesFiltradasPorPessoa.length} item(ns)</span>
              </div>

              {transacoesDoMesFiltradasPorPessoa.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-6 text-center">Nenhum lançamento encontrado para este mês com o filtro selecionado.</p>
              ) : (
                transacoesDoMesFiltradasPorPessoa.map(t => {
                  const valorExibido = (t.tipoDivisao === '50/50' && filtroPessoa !== 'todos') 
                    ? arredondar2(t.valor / 2) 
                    : t.valor;

                  return (
                    <div key={t.id} className={`p-3 rounded-xl border ${editandoTransacao?.id === t.id ? 'border-amber-500 bg-amber-500/10' : t.eAutofinanciamento ? 'border-indigo-400 bg-indigo-50/20' : modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} flex items-center justify-between shadow-sm`}>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded font-semibold ${t.pagador === 'pequeno' ? 'bg-cyan-100 text-cyan-800' : 'bg-pink-100 text-pink-800'}`}>
                            {t.pagador === 'pequeno' ? 'Pequeno' : 'Pequena'}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">{t.categoria}</span>
                          {t.tipoDivisao === '50/50' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-bold border border-amber-500/30">
                              Devolução 50/50 {filtroPessoa !== 'todos' ? '(Sua parte: 50%)' : ''}
                            </span>
                          )}
                          <span className="font-semibold text-sm">{t.descricao}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="font-bold text-sm">R$ {Number(valorExibido).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          {t.tipoDivisao === '50/50' && filtroPessoa !== 'todos' && (
                            <span className="text-[10px] text-slate-400 block">Total: R$ {Number(t.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => iniciarEdicaoTransacao(t)} className="text-slate-400 hover:text-amber-500 p-1" title="Editar lançamento">
                            <Edit3 className="w-4 h-4"/>
                          </button>
                          <button onClick={() => removerTransacao(t.id)} className="text-slate-400 hover:text-rose-500 p-1" title="Excluir lançamento">
                            <Trash2 className="w-4 h-4"/>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
