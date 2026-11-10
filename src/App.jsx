import React, { useState, useEffect, useMemo } from 'react';
import { 
  PlusCircle, Trash2, Moon, Sun, 
  PiggyBank, Plane, Wallet, Settings, Mic, MicOff, LogOut, Lock, Mail, Sparkles, PieChart, Users, CheckCircle2, Utensils, Edit3, X, Calendar, ArrowRightLeft, Filter, Fingerprint, KeyRound, Zap, Plus, AlertTriangle, Repeat
} from 'lucide-react';

import { initializeApp } from "firebase/app";
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, updatePassword 
} from "firebase/auth";
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

const ATALHOS_INICIAIS_PADRAO = [
  { label: '☕ Café', descricao: 'Café', categoria: 'Alimentação / Delivery' },
  { label: '🥐 Padaria', descricao: 'Padaria', categoria: 'Alimentação / Delivery' },
  { label: '🚗 Uber', descricao: 'Uber', categoria: 'Carro' },
  { label: '🛒 Mercado', descricao: 'Supermercado', categoria: 'Mercado & Casa (Salário)' }
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

const extrairDadosPorVoz = (texto, categorias) => {
  const textoMinusculo = texto.toLowerCase();
  let valorCentavos = 0;
  
  const matchNumero = textoMinusculo.match(/(\d+(?:[\.,]\d{1,2})?)/);
  if (matchNumero) {
    const numStr = matchNumero[1].replace(',', '.');
    const num = parseFloat(numStr);
    if (!isNaN(num)) {
      valorCentavos = Math.round(num * 100);
    }
  }

  let pagador = '';
  if (textoMinusculo.includes('pequena')) pagador = 'pequena';
  if (textoMinusculo.includes('pequeno')) pagador = 'pequeno';

  let tipoDivisao = 'individual';
  if (textoMinusculo.includes('dividir') || textoMinusculo.includes('50/50') || textoMinusculo.includes('meio a meio')) {
    tipoDivisao = '50/50';
  } else if (textoMinusculo.includes('reembolso') || textoMinusculo.includes('devolver') || textoMinusculo.includes('adiantamento')) {
    tipoDivisao = 'reembolso_integral';
  }

  let categoriaEncontrada = null;
  for (const cat of categorias) {
    const palavrasCat = cat.toLowerCase().split(/[\/\s()&]+/);
    if (palavrasCat.some(p => p.length > 3 && textoMinusculo.includes(p))) {
      categoriaEncontrada = cat;
      break;
    }
  }

  return {
    valorFormatado: valorCentavos > 0 ? formatarMoedaInput(String(valorCentavos)) : '',
    pagador,
    tipoDivisao,
    categoria: categoriaEncontrada
  };
};

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [emailLogin, setEmailLogin] = useState('');
  const [senhaLogin, setSenhaLogin] = useState('');
  const [erroAuth, setErroAuth] = useState('');
  const [mensagemSucessoAuth, setMensagemSucessoAuth] = useState('');
  const [modoEsqueciSenha, setModoEsqueciSenha] = useState(false);

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
      if (!listaSalva.includes('Autofinanciamento (Devolução)')) listaSalva.push('Autofinanciamento (Devolução)');
      return listaSalva;
    }
    return CATEGORIAS_PADRAO;
  });

  const [limitesOrcamento, setLimitesOrcamento] = useState(() => {
    const salvo = localStorage.getItem('nossobolso_limites_orcamento');
    if (salvo) return JSON.parse(salvo);
    return {
      'Alimentação / Delivery': 1000,
      'Mercado & Casa (Salário)': 1500,
      'Lazer & Superfaturados': 600,
      'Carro': 500
    };
  });

  const [categoriaSelecionadaLimite, setCategoriaSelecionadaLimite] = useState(CATEGORIAS_PADRAO[0]);
  const [valorLimiteInput, setValorLimiteInput] = useState('');

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
  const [novaSenhaConfig, setNovaSenhaConfig] = useState('');
  const [novaCategoriaInput, setNovaCategoriaInput] = useState('');

  const [atalhosGerais, setAtalhosGerais] = useState(() => {
    const salvo = localStorage.getItem('nossobolso_atalhos_gerais');
    if (salvo) return JSON.parse(salvo);
    return [...ATALHOS_INICIAIS_PADRAO];
  });
  const [novoAtalhosLabel, setNovoAtalhosLabel] = useState('');
  const [mostrandoAddAtalho, setMostrandoAddAtalho] = useState(false);

  const adicionarAtalhoPessoal = (e) => {
    e.preventDefault();
    if (!novoAtalhosLabel.trim()) return;

    const novoAtalho = {
      label: novoAtalhosLabel.trim(),
      descricao: novoAtalhosLabel.trim().replace(/^[^\w\s]+/, '').trim() || 'Gasto',
      categoria: form.categoria
    };

    const atualizados = [...atalhosGerais, novoAtalho];
    setAtalhosGerais(atualizados);
    localStorage.setItem('nossobolso_atalhos_gerais', JSON.stringify(atualizados));
    setNovoAtalhosLabel('');
    setMostrandoAddAtalho(false);
  };

  const removerAtalhoPessoal = (indexRemover) => {
    const atualizados = atalhosGerais.filter((_, idx) => idx !== indexRemover);
    setAtalhosGerais(atualizados);
    localStorage.setItem('nossobolso_atalhos_gerais', JSON.stringify(atualizados));
  };

  const [form, setForm] = useState({
    descricao: '',
    valor: '',
    modoValor: 'fixo',
    categoria: CATEGORIAS_PADRAO[0],
    pagador: '',
    tipoDivisao: 'individual',
    meioPagamento: 'salario',
    eFixoRecorrente: false, // Despesa fixa mensal sem fim
    eParcelado: false,      // Se marcado, exige quantidade de parcelas
    parcelas: 2,            // Quantidade padrão se parcelado
    eAutofinanciamento: false,
    eReceita: false,
    mesCompetencia: '2026-11'
  });

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
          if (dados.limitesOrcamento) {
            setLimitesOrcamento(dados.limitesOrcamento);
            localStorage.setItem('nossobolso_limites_orcamento', JSON.stringify(dados.limitesOrcamento));
          }
          if (dados.categorias && Array.isArray(dados.categorias)) {
            let catNuvem = dados.categorias;
            if (!catNuvem.includes('Investimentos / Aportes')) catNuvem.push('Investimentos / Aportes');
            if (!catNuvem.includes('Renda Extra / Serviços (Aporte)')) catNuvem.push('Renda Extra / Serviços (Aporte)');
            if (!catNuvem.includes('Carro')) catNuvem.push('Carro');
            if (!catNuvem.includes('Autofinanciamento (Devolução)')) catNuvem.push('Autofinanciamento (Devolução)');
            setCategorias(catNuvem);
            localStorage.setItem('nossobolso_categorias', JSON.stringify(catNuvem));
          }
        }
      } catch (e) {
        console.error("Erro ao carregar do Firestore", e);
      }
    }
    carregarDadosNuvem();
  }, [usuario]);

  const salvarConfiguracoesNaNuvem = async (novosPerfis, novasCategorias, novosLimites) => {
    localStorage.setItem('nossobolso_categorias', JSON.stringify(novasCategorias));
    if (novosLimites) {
      localStorage.setItem('nossobolso_limites_orcamento', JSON.stringify(novosLimites));
    }
    
    if (db && usuario) {
      try {
        await setDoc(doc(db, "configuracoes", "geral"), {
          perfis: novosPerfis,
          categorias: novasCategorias,
          limitesOrcamento: novosLimites || limitesOrcamento
        }, { merge: true });
        
        setStatusAviso({
          tipo: 'sucesso',
          mensagem: 'Alterações salvas e sincronizadas com sucesso!'
        });
        setTimeout(() => setStatusAviso({ tipo: '', mensagem: '' }), 4000);
      } catch (err) {
        setStatusAviso({
          tipo: 'erro',
          mensagem: 'Falha ao sincronizar com a nuvem.'
        });
      }
    }
  };

  const handleSalvarLimiteOrcamento = (e) => {
    e.preventDefault();
    const valNum = Number(parseMoedaInput(valorLimiteInput)) || 0;
    const novosLimites = {
      ...limitesOrcamento,
      [categoriaSelecionadaLimite]: valNum
    };
    setLimitesOrcamento(novosLimites);
    salvarConfiguracoesNaNuvem(perfis, categorias, novosLimites);
    setValorLimiteInput('');
  };

  const removerLimiteOrcamento = (catKey) => {
    const novosLimites = { ...limitesOrcamento };
    delete novosLimites[catKey];
    setLimitesOrcamento(novosLimites);
    salvarConfiguracoesNaNuvem(perfis, categorias, novosLimites);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErroAuth('');
    setMensagemSucessoAuth('');
    if (!auth) {
      setUsuario({ email: emailLogin });
      return;
    }
    try {
      const res = await signInWithEmailAndPassword(auth, emailLogin, senhaLogin);
      localStorage.setItem('nossobolso_ultimo_email', emailLogin);
      setUsuario(res.user);
    } catch (err) {
      try {
        const resReg = await createUserWithEmailAndPassword(auth, emailLogin, senhaLogin);
        localStorage.setItem('nossobolso_ultimo_email', emailLogin);
        setUsuario(resReg.user);
      } catch (err2) {
        setErroAuth('Erro de login ou senha incorreta.');
      }
    }
  };

  const handleEnviarRecuperacaoSenha = async (e) => {
    e.preventDefault();
    setErroAuth('');
    setMensagemSucessoAuth('');
    if (!emailLogin) {
      setErroAuth('Digite seu e-mail.');
      return;
    }
    try {
      if (auth) await sendPasswordResetEmail(auth, emailLogin);
      setMensagemSucessoAuth(`E-mail de recuperação enviado para ${emailLogin}!`);
    } catch (err) {
      setErroAuth('Não foi possível enviar o e-mail.');
    }
  };

  const handleLoginBiometria = async () => {
    setErroAuth('');
    const emailSalvo = localStorage.getItem('nossobolso_ultimo_email');
    if (!emailSalvo) {
      setErroAuth('Faça o primeiro login com e-mail e senha.');
      return;
    }
    setUsuario({ email: emailSalvo });
  };

  const handleAlterarSenhaLogado = async (e) => {
    e.preventDefault();
    if (!novaSenhaConfig || novaSenhaConfig.length < 6) {
      alert("Mínimo 6 caracteres.");
      return;
    }
    if (auth && auth.currentUser) {
      try {
        await updatePassword(auth.currentUser, novaSenhaConfig);
        alert("Senha alterada com sucesso!");
        setNovaSenhaConfig('');
      } catch (err) {
        alert("Faça o re-login para alterar a senha.");
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

    let reembolsoIntegralPequenoRecebe = 0; 
    let reembolsoIntegralPequenaRecebe = 0; 

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
      } else if (t.tipoDivisao === 'reembolso_integral') {
        if (t.pagador === 'pequeno') {
          reembolsoIntegralPequenoRecebe += valor;
        } else if (t.pagador === 'pequena') {
          reembolsoIntegralPequenaRecebe += valor;
        }
      }
    });

    transacoesDashboardAtivas.forEach(t => {
      if (t.eReceita) return;
      const valorOriginal = arredondar2(t.valor);
      const cat = t.categoria || 'Outros';

      if (t.eAutofinanciamento || cat.includes('Autofinanciamento')) {
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
      } else if (t.tipoDivisao === 'reembolso_integral') {
        if (t.pagador === 'pequeno') {
          pesoNoOrcamentoPequena = valorOriginal; 
        } else {
          pesoNoOrcamentoPequeno = valorOriginal; 
        }
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
    
    const saldoLiquido5050Pequeno = arredondar2(totalPagoPeloPequenoEm50_50 - parteIdealCadaUm);
    const saldoLiquidoPequeno = arredondar2(
      saldoLiquido5050Pequeno + reembolsoIntegralPequenoRecebe - reembolsoIntegralPequenaRecebe
    );

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
      reembolsoIntegralPequenoRecebe,
      reembolsoIntegralPequenaRecebe,
      saldoLiquidoPequeno
    };
  }, [transacoes, transacoesDoMes, transacoesDashboardAtivas, perfis, filtroPessoa, modoVisualizacaoDashboard]);

  const handleSalvarTransacao = async (e) => {
    e.preventDefault();
    if (!form.pagador) {
      alert("Por favor, selecione quem pagou a despesa.");
      return;
    }

    const valorNumerico = arredondar2(parseFloat(parseMoedaInput(form.valor)));
    if (!form.descricao || isNaN(valorNumerico)) return;

    if (editandoTransacao) {
      let atualizarProximos = false;
      if (editandoTransacao.grupoId || editandoTransacao.parcelas > 1 || editandoTransacao.eFixoRecorrente) {
        atualizarProximos = window.confirm(
          "Deseja aplicar esta alteração a este lançamento e a TODOS os próximos meses futuros desta despesa?"
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
                descricao: t.eFixoRecorrente ? form.descricao : (t.parcelas > 1 ? `${form.descricao} (${t.parcelaAtual}/${t.parcelas})` : form.descricao)
              }).catch(err => console.error(err));
            }
            return {
              ...t,
              ...dadosAtualizados,
              descricao: t.eFixoRecorrente ? form.descricao : (t.parcelas > 1 ? `${form.descricao} (${t.parcelaAtual}/${t.parcelas})` : form.descricao)
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
      const isFixo = form.eFixoRecorrente;
      const isParcelado = form.eParcelado;

      // Se for fixo, projeta para frente por 12 meses (padrão sem exigir número de parcelas). Se for parcelado, usa o número de parcelas informado.
      const numRepeticoes = isFixo ? 12 : (isParcelado ? Math.max(1, parseInt(form.parcelas) || 1) : 1);

      const valorPorMes = form.modoValor === 'fixo' || isFixo || !isParcelado
        ? valorNumerico 
        : arredondar2(valorNumerico / numRepeticoes);

      const [anoBase, mesBase] = form.mesCompetencia.split('-').map(Number);
      const novasTransacoes = [];
      const grupoId = `grupo-${Date.now()}`;

      for (let i = 0; i < numRepeticoes; i++) {
        let dataParcela = new Date(anoBase, mesBase - 1 + i, 5);
        let strAno = dataParcela.getFullYear();
        let strMes = String(dataParcela.getMonth() + 1).padStart(2, '0');
        let competenciaParcela = `${strAno}-${strMes}`;
        
        const isAutofin = form.categoria === 'Autofinanciamento (Devolução)';
        const descricaoFinal = isParcelado && numRepeticoes > 1
          ? `${form.descricao} (${i + 1}/${numRepeticoes})` 
          : form.descricao;

        const novaT = {
          data: `${strAno}-${strMes}-05`,
          mesCompetencia: competenciaParcela,
          descricao: descricaoFinal,
          valor: valorPorMes,
          categoria: form.categoria,
          pagador: form.pagador,
          tipoDivisao: form.tipoDivisao,
          meioPagamento: form.meioPagamento,
          parcelas: isParcelado ? numRepeticoes : 1,
          parcelaAtual: isParcelado ? i + 1 : 1,
          eFixoRecorrente: isFixo,
          grupoId: numRepeticoes > 1 || isFixo || isAutofin ? grupoId : null,
          eAutofinanciamento: isAutofin,
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

    setForm({
      descricao: '',
      valor: '',
      modoValor: 'fixo',
      categoria: categoriasOrdenadas[0] || '',
      pagador: '',
      tipoDivisao: 'individual',
      meioPagamento: 'salario',
      eFixoRecorrente: false,
      eParcelado: false,
      parcelas: 2,
      eAutofinanciamento: false,
      eReceita: false,
      mesCompetencia: mesFiltro
    });
  };

  const iniciarEdicaoTransacao = (t) => {
    setEditandoTransacao(t);
    const descLimpa = t.eFixoRecorrente ? t.descricao : t.descricao.replace(/\s*\(\d+\/\d+\)$/, '');
    
    setForm({
      descricao: descLimpa,
      valor: formatarMoedaInput(String(Math.round(t.valor * 100))),
      modoValor: 'fixo',
      categoria: t.categoria,
      pagador: t.pagador || '',
      tipoDivisao: t.tipoDivisao || 'individual',
      meioPagamento: t.meioPagamento || 'salario',
      eFixoRecorrente: t.eFixoRecorrente || false,
      eParcelado: (t.parcelas && t.parcelas > 1) || false,
      parcelas: t.parcelas || 2,
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
      pagador: '',
      tipoDivisao: 'individual',
      meioPagamento: 'salario',
      eFixoRecorrente: false,
      eParcelado: false,
      parcelas: 2,
      eAutofinanciamento: false,
      eReceita: false,
      mesCompetencia: mesFiltro
    });
  };

  const removerTransacao = async (tAlvo) => {
    let excluirProximos = false;
    if (tAlvo.grupoId || (tAlvo.parcelas && tAlvo.parcelas > 1) || tAlvo.eFixoRecorrente) {
      excluirProximos = window.confirm(
        "Deseja excluir apenas deste mês ou OK para excluir ESTE e TODOS os PRÓXIMOS meses futuros desta despesa?"
      );
    } else {
      if (!window.confirm("Deseja realmente excluir este lançamento?")) return;
    }

    if (excluirProximos && tAlvo.grupoId) {
      const idGrupo = tAlvo.grupoId;
      const parcelaRef = tAlvo.parcelaAtual || 1;

      const transacoesParaExcluir = transacoes.filter(t => t.grupoId === idGrupo && (t.parcelaAtual >= parcelaRef || !t.parcelaAtual));

      for (const tDel of transacoesParaExcluir) {
        if (db && usuario) {
          try {
            await deleteDoc(doc(db, "transacoes", tDel.id));
          } catch (err) {
            console.error("Erro ao deletar da nuvem", err);
          }
        }
      }

      setTransacoes(prev => prev.filter(t => !(t.grupoId === idGrupo && (t.parcelaAtual >= parcelaRef || !t.parcelaAtual))));
    } else {
      if (db && usuario) {
        try {
          await deleteDoc(doc(db, "transacoes", tAlvo.id));
        } catch (err) {
          console.error("Erro ao deletar", err);
        }
      }
      setTransacoes(prev => prev.filter(t => t.id !== tAlvo.id));
    }

    if (editandoTransacao?.id === tAlvo.id) cancelarEdicao();
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
      alert("Seu navegador não suporta voz.");
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
      const transcricao = event.results[0][0].transcript;
      const extraido = extrairDadosPorVoz(transcricao, categorias);

      setForm(prev => ({
        ...prev,
        descricao: transcricao,
        valor: extraido.valorFormatado || prev.valor,
        pagador: extraido.pagador || prev.pagador,
        tipoDivisao: extraido.tipoDivisao || prev.tipoDivisao,
        categoria: extraido.categoria || prev.categoria
      }));
    };

    recognition.start();
  };

  if (!usuario) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-slate-800 p-6 sm:p-8 rounded-2xl border border-slate-700 shadow-xl space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 bg-gradient-to-tr from-cyan-500 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center mb-3 shadow-lg shadow-cyan-500/20">
              <Sparkles className="w-7 h-7 text-white"/>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Nosso Bolso</h1>
            <p className="text-xs text-slate-400 mt-1">Controle Financeiro Inteligente do Casal</p>
          </div>

          {erroAuth && <div className="p-3 bg-rose-500/20 border border-rose-500 text-rose-300 text-xs rounded-lg">{erroAuth}</div>}
          {mensagemSucessoAuth && <div className="p-3 bg-emerald-500/20 border border-emerald-500 text-emerald-300 text-xs rounded-lg">{mensagemSucessoAuth}</div>}

          {!modoEsqueciSenha ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">E-mail de Acesso</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3"/>
                  <input 
                    type="email" required placeholder="casal@email.com"
                    value={emailLogin} onChange={(e) => setEmailLogin(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 text-sm rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-400">Senha</label>
                  <button 
                    type="button" 
                    onClick={() => { setModoEsqueciSenha(true); setErroAuth(''); setMensagemSucessoAuth(''); }}
                    className="text-xs text-cyan-400 hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3"/>
                  <input 
                    type="password" required placeholder="••••••••"
                    value={senhaLogin} onChange={(e) => setSenhaLogin(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 text-sm rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <button type="submit" className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold py-3 rounded-lg text-sm transition-all shadow-lg shadow-blue-500/25">
                Entrar ou Cadastrar
              </button>

              <button 
                type="button" 
                onClick={handleLoginBiometria}
                className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-2.5 rounded-lg text-sm border border-slate-600 flex items-center justify-center gap-2 transition-all"
              >
                <Fingerprint className="w-5 h-5 text-cyan-400"/>
                Entrar com Conta Salva no Aparelho
              </button>
            </form>
          ) : (
            <form onSubmit={handleEnviarRecuperacaoSenha} className="space-y-4">
              <p className="text-xs text-slate-300">Digite seu e-mail cadastrado:</p>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">E-mail</label>
                <input 
                  type="email" required placeholder="seuemail@email.com"
                  value={emailLogin} onChange={(e) => setEmailLogin(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg bg-slate-700 border border-slate-600 text-white"
                />
              </div>
              <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-3 rounded-lg text-sm">
                Enviar Link
              </button>
              <button type="button" onClick={() => setModoEsqueciSenha(false)} className="w-full text-xs text-slate-400 hover:text-white py-1">
                Voltar para o Login
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${modoEscuro ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'} transition-colors duration-200 font-sans pb-12`}>
      <header className={`sticky top-0 z-50 ${modoEscuro ? 'bg-slate-800/90 border-slate-700' : 'bg-white/90 border-slate-200'} backdrop-blur-md border-b px-3 sm:px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-2 sm:p-2.5 bg-gradient-to-tr from-cyan-500 to-indigo-600 rounded-xl text-white shadow-md shadow-cyan-500/20 shrink-0">
            <Sparkles className="w-5 h-5"/>
          </div>
          <div>
            <h1 className="font-bold text-base sm:text-lg leading-tight tracking-tight">Nosso Bolso</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {abaAtiva === 'dashboard' ? (
            modoVisualizacaoDashboard === 'mes' ? (
              <input 
                type="month" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)}
                className={`text-xs sm:text-sm px-2 sm:px-3 py-1.5 rounded-lg border font-medium ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
              />
            ) : (
              <select 
                value={anoFiltro} onChange={(e) => setAnoFiltro(e.target.value)}
                className={`text-xs sm:text-sm px-2 sm:px-3 py-1.5 rounded-lg border font-medium ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
              >
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            )
          ) : (
            <input 
              type="month" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)}
              className={`text-xs sm:text-sm px-2 sm:px-3 py-1.5 rounded-lg border font-medium ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
            />
          )}

          <button onClick={alternarTema} className={`p-2 rounded-lg border ${modoEscuro ? 'bg-slate-700 border-slate-600 text-yellow-400' : 'bg-slate-100 border-slate-300 text-slate-600'}`} title={modoEscuro ? "Modo Claro" : "Modo Escuro"}>
            {modoEscuro ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
          </button>
          <button onClick={handleLogout} className="p-2 rounded-lg border bg-rose-500/10 text-rose-500 border-rose-500/30 hover:bg-rose-500/20" title="Sair">
            <LogOut className="w-4 h-4"/>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 mt-4 sm:mt-6">
        <div className={`p-3 rounded-xl border mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-sm ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-500 shrink-0"/>
            <span className="text-xs font-semibold text-slate-500">Visualizar por:</span>
          </div>
          <div className="flex gap-1.5 w-full sm:w-auto">
            {[
              { id: 'todos', label: 'Casal (Ambos)' },
              { id: 'pequeno', label: 'Pequeno' },
              { id: 'pequena', label: 'Pequena' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFiltroPessoa(f.id)}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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

        <nav className="flex gap-1.5 sm:gap-2 mb-6 border-b border-slate-200 dark:border-slate-700 overflow-x-auto pb-2 scrollbar-none">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Wallet },
            { id: 'lancamentos', label: 'Lançamentos', icon: PlusCircle },
            { id: 'viagens', label: 'Caixinha Viagem', icon: Plane },
            { id: 'config', label: 'Configurações', icon: Settings }
          ].map(aba => {
            const Icon = aba.icon;
            const ativo = abaAtiva === aba.id;
            return (
              <button
                key={aba.id} onClick={() => setAbaAtiva(aba.id)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
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
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-200 dark:bg-slate-800 p-2 sm:p-1.5 rounded-xl border border-slate-300 dark:border-slate-700 gap-2">
              <div className="flex items-center gap-2 px-1">
                <Calendar className="w-4 h-4 text-cyan-500 shrink-0"/>
                <span className="text-xs font-bold">Período de Análise:</span>
              </div>
              <div className="flex gap-1 w-full sm:w-auto">
                <button
                  onClick={() => setModoVisualizacaoDashboard('mes')}
                  className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    modoVisualizacaoDashboard === 'mes'
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Mensal ({mesFiltro})
                </button>
                <button
                  onClick={() => setModoVisualizacaoDashboard('ano')}
                  className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    modoVisualizacaoDashboard === 'ano'
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Anual ({anoFiltro})
                </button>
              </div>
            </div>

            <div className={`p-4 sm:p-5 rounded-2xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-md space-y-3 border-l-4 border-l-cyan-500`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 sm:p-3 bg-cyan-100 text-cyan-600 rounded-xl shrink-0">
                    <ArrowRightLeft className="w-5 h-5 sm:w-6 sm:h-6"/>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Acerto de Contas & Reembolsos (PIX)</h3>
                    <p className="text-[11px] text-slate-400">Soma das despesas 50/50 e adiantamentos/reembolsos integrais.</p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[10px] text-slate-400 block">Total Compartilhado ({mesFiltro})</span>
                  <span className="text-sm font-bold">R$ {calculos.totalGasto5050Mes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className={`p-3 sm:p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${modoEscuro ? 'bg-slate-700/40 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400 block">Resumo dos Pagamentos do Mês:</span>
                  <p className="text-xs">• Pago pelo Pequeno (50/50): <strong>R$ {calculos.totalPagoPeloPequenoEm50_50.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
                  <p className="text-xs">• Pago pela Pequena (50/50): <strong>R$ {calculos.totalPagoPelaPequenaEm50_50.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
                </div>

                <div className="text-left md:text-right border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-6 border-slate-300 dark:border-slate-600 w-full md:w-auto">
                  {calculos.saldoLiquidoPequeno > 0 ? (
                    <div>
                      <span className="text-[10px] font-semibold text-pink-400 block uppercase">PIX de Acerto Devido</span>
                      <span className="text-sm sm:text-base font-bold text-pink-300">Pequena faz PIX de R$ {calculos.saldoLiquidoPequeno.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ao Pequeno</span>
                    </div>
                  ) : calculos.saldoLiquidoPequeno < 0 ? (
                    <div>
                      <span className="text-[10px] font-semibold text-cyan-400 block uppercase">PIX de Acerto Devido</span>
                      <span className="text-sm sm:text-base font-bold text-cyan-300">Pequeno faz PIX de R$ {Math.abs(calculos.saldoLiquidoPequeno).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} à Pequena</span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-[10px] font-semibold text-emerald-400 block uppercase">Contas Acertadas</span>
                      <span className="text-xs sm:text-sm font-bold text-emerald-300">Nenhum PIX pendente entre vocês!</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div className={`p-3.5 sm:p-4 rounded-xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-sm`}>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium">Gastos Totais</p>
                <p className="text-base sm:text-xl font-bold mt-1">R$ {calculos.gastosSalarioTotais.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className={`p-3.5 sm:p-4 rounded-xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-sm border-l-4 border-l-amber-500`}>
                <p className="text-[11px] sm:text-xs text-amber-500 font-semibold flex items-center gap-1"><Utensils className="w-3 h-3"/> Alimentação</p>
                <p className="text-base sm:text-xl font-bold mt-1">R$ {calculos.totalAlimentacaoConsolidado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className={`p-3.5 sm:p-4 rounded-xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-sm border-l-4 border-l-cyan-500`}>
                <p className="text-[11px] sm:text-xs text-cyan-500 font-semibold">Livre Pequeno</p>
                <p className="text-sm sm:text-lg font-bold mt-1">R$ {calculos.orcamentoLivrePequeno.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className={`p-3.5 sm:p-4 rounded-xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-sm border-l-4 border-l-pink-500`}>
                <p className="text-[11px] sm:text-xs text-pink-500 font-semibold">Livre Pequena</p>
                <p className="text-sm sm:text-lg font-bold mt-1">R$ {calculos.orcamentoLivrePequena.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>

            {Object.keys(limitesOrcamento).length > 0 && (
              <div className={`p-4 sm:p-5 rounded-2xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-md space-y-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-400"/>
                    <h3 className="font-bold text-sm sm:text-base">Alertas de Orçamento por Categoria</h3>
                  </div>
                  <span className="text-[11px] text-slate-400">Monitorando tetos definidos</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {Object.entries(limitesOrcamento).map(([cat, limite]) => {
                    const gastoAtual = calculos.gastosPorCategoria[cat] || 0;
                    const percentual = limite > 0 ? (gastoAtual / limite) * 100 : 0;
                    
                    let corBarra = 'bg-emerald-500';
                    let corTexto = 'text-emerald-400';
                    let statusTexto = 'Dentro do teto';

                    if (percentual >= 100) {
                      corBarra = 'bg-rose-500';
                      corTexto = 'text-rose-400';
                      statusTexto = '🚨 Teto estourado!';
                    } else if (percentual >= 80) {
                      corBarra = 'bg-amber-500';
                      corTexto = 'text-amber-400';
                      statusTexto = '⚠️ Próximo ao limite';
                    }

                    return (
                      <div key={cat} className={`p-3 rounded-xl border ${modoEscuro ? 'bg-slate-700/30 border-slate-700' : 'bg-slate-50 border-slate-200'} space-y-2`}>
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold truncate pr-2">{cat}</span>
                          <span className={`font-bold shrink-0 ${corTexto}`}>
                            R$ {gastoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / R$ {limite.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="w-full bg-slate-300 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                          <div className={`${corBarra} h-full transition-all duration-500`} style={{ width: `${Math.min(100, percentual)}%` }}></div>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className={corTexto}>{statusTexto}</span>
                          <span className="text-slate-400 font-medium">{percentual.toFixed(0)}% usado</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className={`p-4 sm:p-6 rounded-2xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-md space-y-4`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-cyan-500"/>
                  <h3 className="font-bold text-sm sm:text-base">Distribuição por Categoria</h3>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-500">
                  Total: R$ {calculos.gastosSalarioTotais.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">💡 Dica: Clique em qualquer categoria abaixo para filtrar instantaneamente os lançamentos dela.</p>

              {Object.keys(calculos.gastosPorCategoria).length === 0 ? (
                <p className="text-xs text-slate-400 italic py-6 text-center">Nenhum gasto registrado para este período.</p>
              ) : (
                <div className="space-y-4">
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-3.5 rounded-full overflow-hidden flex shadow-inner">
                    {Object.entries(calculos.gastosPorCategoria).map(([cat, val], idx) => {
                      const porcentagem = calculos.gastosSalarioTotais > 0 ? (val / calculos.gastosSalarioTotais) * 100 : 0;
                      if (porcentagem <= 0) return null;
                      const cores = [
                        'bg-cyan-500', 'bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 
                        'bg-pink-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 
                        'bg-teal-500', 'bg-violet-500', 'bg-fuchsia-500'
                      ];
                      return (
                        <div 
                          key={cat}
                          className={`${cores[idx % cores.length]} h-full transition-all duration-500 cursor-pointer hover:opacity-80`}
                          onClick={() => {
                            setFiltroCategoriaLancamentos(cat);
                            setAbaAtiva('lancamentos');
                          }}
                          style={{ width: `${porcentagem}%` }}
                          title={`${cat}: R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${porcentagem.toFixed(1)}%)`}
                        ></div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                    {Object.entries(calculos.gastosPorCategoria).sort((a, b) => b[1] - a[1]).map(([cat, val]) => {
                      const porcentagem = calculos.gastosSalarioTotais > 0 ? (val / calculos.gastosSalarioTotais) * 100 : 0;
                      return (
                        <div 
                          key={cat} 
                          onClick={() => {
                            setFiltroCategoriaLancamentos(cat);
                            setAbaAtiva('lancamentos');
                          }}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${modoEscuro ? 'bg-slate-700/30 border-slate-700 hover:bg-slate-700/60 hover:border-cyan-500/50' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-cyan-500'}`}
                        >
                          <span className="text-xs font-semibold text-ellipsis overflow-hidden pr-2">{cat}</span>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold block">R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span className="text-[10px] text-cyan-400 font-semibold">{porcentagem.toFixed(1)}% ➔</span>
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

        {abaAtiva === 'viagens' && (
          <div className={`p-5 sm:p-6 rounded-2xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-md`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                <Plane className="w-6 h-6"/>
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold">Caixinha de Viagem / Férias</h2>
                <p className="text-xs text-slate-400">Acúmulo de reservas para viagens e 13º/férias.</p>
              </div>
            </div>
            <p className="text-xl font-bold text-emerald-600 mt-4">Total Acumulado: R$ {calculos.caixinhaViagens.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        )}

        {abaAtiva === 'config' && (
          <div className="space-y-6">
            <div className={`p-5 sm:p-6 rounded-2xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-md space-y-4`}>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-cyan-500"/> Alterar Senha da Conta
              </h2>
              <form onSubmit={handleAlterarSenhaLogado} className="space-y-3 max-w-md">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Nova Senha</label>
                  <input 
                    type="password" required placeholder="Mínimo 6 caracteres"
                    value={novaSenhaConfig} onChange={(e) => setNovaSenhaConfig(e.target.value)}
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                  />
                </div>
                <button type="submit" className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-xs font-semibold">
                  Atualizar Minha Senha
                </button>
              </form>
            </div>

            <div className={`p-5 sm:p-6 rounded-2xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-md space-y-4`}>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500"/> Limites de Orçamento por Categoria
              </h2>
              <p className="text-xs text-slate-400">Defina tetos mensais para receber alertas visuais.</p>

              <form onSubmit={handleSalvarLimiteOrcamento} className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <select
                  value={categoriaSelecionadaLimite}
                  onChange={(e) => setCategoriaSelecionadaLimite(e.target.value)}
                  className={`text-xs px-3 py-2 rounded-lg border font-semibold ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                >
                  {categoriasOrdenadas.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <input 
                  type="text" placeholder="Teto Mensal (R$ 0,00)"
                  value={valorLimiteInput}
                  onChange={(e) => setValorLimiteInput(formatarMoedaInput(e.target.value))}
                  className={`text-xs px-3 py-2 rounded-lg border font-semibold ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                />
                <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-xs font-semibold">
                  Definir Teto
                </button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 max-h-60 overflow-y-auto">
                {Object.entries(limitesOrcamento).map(([cat, limite]) => (
                  <div key={cat} className={`flex justify-between items-center p-2.5 rounded-lg border ${modoEscuro ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                    <div>
                      <span className="text-xs font-medium block">{cat}</span>
                      <span className="text-[11px] font-bold text-amber-400">Teto: R$ {Number(limite).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <button onClick={() => removerLimiteOrcamento(cat)} className="text-slate-400 hover:text-rose-500 p-1">
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className={`p-5 sm:p-6 rounded-2xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-md space-y-4`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-500"/> Parâmetros de Salários e VA
                </h2>
                <button 
                  onClick={() => salvarConfiguracoesNaNuvem(perfis, categorias)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg text-xs shadow-md transition-all flex items-center gap-1.5"
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
                            setPerfis({ ...perfis, [perfilKey]: { ...p, salario: val } });
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
                            setPerfis({ ...perfis, [perfilKey]: { ...p, va: val } });
                          }}
                          className={`w-full px-3 py-1.5 text-sm rounded-lg border ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block">Meta de Reserva (R$)</label>
                        <input 
                          type="text" value={p.metaInvestimento}
                          onChange={(e) => {
                            const val = formatarMoedaInput(e.target.value);
                            setPerfis({ ...perfis, [perfilKey]: { ...p, metaInvestimento: val } });
                          }}
                          className={`w-full px-3 py-1.5 text-sm rounded-lg border ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`p-5 sm:p-6 rounded-2xl border ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-md space-y-4`}>
              <h2 className="text-base sm:text-lg font-bold">Categorias de Gastos</h2>
              
              <form onSubmit={adicionarCategoria} className="flex gap-2">
                <input 
                  type="text" placeholder="Nova categoria..."
                  value={novaCategoriaInput} onChange={(e) => setNovaCategoriaInput(e.target.value)}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                />
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold">
                  Adicionar
                </button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 max-h-60 overflow-y-auto">
                {categoriasOrdenadas.map(cat => (
                  <div key={cat} className={`flex justify-between items-center p-2.5 rounded-lg border ${modoEscuro ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-xs font-medium">{cat}</span>
                    <button onClick={() => removerCategoria(cat)} className="text-slate-400 hover:text-rose-500 p-1">
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      ouvindoVoz ? 'bg-rose-500 text-white animate-pulse' : 'bg-cyan-500/10 text-cyan-600 border border-cyan-500/30 hover:bg-cyan-500/20'
                    }`}
                    title="Falar gasto por voz"
                  >
                    {ouvindoVoz ? <MicOff className="w-3.5 h-3.5"/> : <Mic className="w-3.5 h-3.5"/>}
                    {ouvindoVoz ? 'Ouvindo...' : 'Falar Gasto'}
                  </button>
                )}
              </div>

              {!editandoTransacao && (
                <div className="space-y-2 pb-3 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-400"/> Atalhos Rápidos
                    </span>
                    <button 
                      type="button" 
                      onClick={() => setMostrandoAddAtalho(prev => !prev)}
                      className="text-[11px] text-cyan-400 hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3"/> {mostrandoAddAtalho ? 'Fechar' : 'Novo Atalho'}
                    </button>
                  </div>

                  {mostrandoAddAtalho && (
                    <form onSubmit={adicionarAtalhoPessoal} className="flex gap-1.5 pt-1">
                      <input 
                        type="text" placeholder="Ex: 💅 Manicure ou 🍔 Lanche"
                        value={novoAtalhosLabel} onChange={(e) => setNovoAtalhosLabel(e.target.value)}
                        className={`flex-1 px-2.5 py-1.5 text-xs rounded-lg border ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                      />
                      <button type="submit" className="bg-cyan-600 hover:bg-cyan-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold">
                        Salvar
                      </button>
                    </form>
                  )}

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {atalhosGerais.map((atalho, index) => (
                      <div key={index} className="group relative flex items-center">
                        <button
                          type="button"
                          onClick={() => {
                            setForm(prev => ({
                              ...prev,
                              descricao: atalho.descricao,
                              categoria: atalho.categoria
                            }));
                          }}
                          className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all border pr-5 ${
                            modoEscuro 
                              ? 'bg-slate-700/60 border-slate-600 text-slate-200 hover:bg-cyan-600 hover:border-cyan-500 hover:text-white' 
                              : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-cyan-500 hover:text-white'
                          }`}
                        >
                          {atalho.label}
                        </button>
                        <button
                          type="button"
                          onClick={() => removerAtalhoPessoal(index)}
                          className="absolute right-1 text-slate-400 hover:text-rose-400 text-[10px] font-bold px-0.5"
                          title="Remover atalho"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleSalvarTransacao} className="space-y-3">
                <input 
                  type="text" required placeholder="Descrição (ex: Energia / Internet)"
                  value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value})}
                  className={`w-full px-3 py-2.5 text-sm rounded-lg border ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                />
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Modo do Valor</label>
                    <select
                      value={form.modoValor}
                      onChange={(e) => setForm({...form, modoValor: e.target.value})}
                      className={`w-full px-2 py-2 text-xs sm:text-sm rounded-lg border font-semibold ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                    >
                      <option value="fixo">Valor p/ Mês</option>
                      <option value="dividir">Valor Total</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      {form.modoValor === 'fixo' ? 'Valor/Mês (R$)' : 'Valor Total (R$)'}
                    </label>
                    <input 
                      type="text" required placeholder="0,00"
                      value={form.valor} 
                      onChange={(e) => setForm({...form, valor: formatarMoedaInput(e.target.value)})}
                      className={`w-full px-3 py-2 text-sm rounded-lg border ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Competência Inicial</label>
                  <input 
                    type="month"
                    value={form.mesCompetencia}
                    onChange={(e) => setForm({...form, mesCompetencia: e.target.value})}
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                  />
                </div>
                
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Categoria</label>
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
                    <label className="text-[11px] text-slate-400 block mb-1">Quem Pagou? *</label>
                    <select
                      required
                      value={form.pagador} onChange={(e) => setForm({...form, pagador: e.target.value})}
                      className={`w-full px-2 py-2 text-xs sm:text-sm rounded-lg border font-semibold ${!form.pagador ? 'border-amber-500 text-amber-500' : ''} ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                    >
                      <option value="" disabled>Selecione...</option>
                      <option value="pequeno">Pequeno</option>
                      <option value="pequena">Pequena</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Tipo de Divisão</label>
                    <select
                      value={form.tipoDivisao} onChange={(e) => setForm({...form, tipoDivisao: e.target.value})}
                      className={`w-full px-2 py-2 text-xs sm:text-sm rounded-lg border font-semibold ${form.tipoDivisao === '50/50' ? 'border-amber-500 text-amber-500' : form.tipoDivisao === 'reembolso_integral' ? 'border-cyan-500 text-cyan-400' : ''} ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                    >
                      <option value="individual">Individual (100%)</option>
                      <option value="50/50">Dividir 50/50 (Casal)</option>
                      <option value="reembolso_integral">Reembolso Integral (PIX)</option>
                    </select>
                  </div>
                </div>

                {/* OPÇÕES DE RECORRÊNCIA OU PARCELAMENTO */}
                <div className={`p-3 rounded-xl border ${modoEscuro ? 'bg-slate-700/30 border-slate-600' : 'bg-slate-50 border-slate-200'} space-y-3`}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={form.eFixoRecorrente}
                      onChange={(e) => setForm({...form, eFixoRecorrente: e.target.checked, eParcelado: false})}
                      className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500"
                    />
                    <span className="text-xs font-bold flex items-center gap-1 text-cyan-400">
                      <Repeat className="w-3.5 h-3.5"/> Despesa Fixa / Recorrente Mensal (Sem fim)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={form.eParcelado}
                      onChange={(e) => setForm({...form, eParcelado: e.target.checked, eFixoRecorrente: false})}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-blue-400">
                      📦 É uma compra parcelada (Com prazo determinado)
                    </span>
                  </label>

                  {form.eParcelado && (
                    <div className="pt-1">
                      <label className="text-[10px] text-slate-400 block mb-1">Quantidade de Parcelas</label>
                      <input 
                        type="number" min="2" max="60" disabled={editandoTransacao !== null}
                        value={form.parcelas}
                        onChange={(e) => setForm({...form, parcelas: e.target.value})}
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border ${editandoTransacao !== null ? 'opacity-50 cursor-not-allowed' : ''} ${modoEscuro ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                      />
                    </div>
                  )}
                </div>

                <button type="submit" className={`w-full font-semibold py-3 rounded-lg text-sm shadow-md transition-colors text-white ${editandoTransacao ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {editandoTransacao ? 'Atualizar Lançamento' : 'Salvar Lançamento'}
                </button>
              </form>
            </div>

            <div className="md:col-span-2 space-y-4">
              <div className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 ${modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-sm`}>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Filter className="w-4 h-4 text-cyan-500 shrink-0"/>
                  <span className="text-xs font-bold text-slate-500">Filtrar Categoria:</span>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
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
                  {filtroCategoriaLancamentos !== 'todas' && (
                    <button 
                      onClick={() => setFiltroCategoriaLancamentos('todas')}
                      className="px-2.5 py-1 text-xs rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 font-semibold"
                    >
                      Limpar Filtro
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs sm:text-sm text-slate-500">
                  Lançamentos: {mesFiltro} {filtroCategoriaLancamentos !== 'todas' && `(${filtroCategoriaLancamentos})`}
                </h3>
                <span className="text-[11px] font-semibold text-slate-400">{transacoesDoMesFiltradasPorPessoa.length} item(ns)</span>
              </div>

              {transacoesDoMesFiltradasPorPessoa.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-6 text-center">Nenhum lançamento encontrado para este filtro.</p>
              ) : (
                transacoesDoMesFiltradasPorPessoa.map(t => {
                  const valorExibido = (t.tipoDivisao === '50/50' && filtroPessoa !== 'todos') 
                    ? arredondar2(t.valor / 2) 
                    : t.valor;

                  return (
                    <div key={t.id} className={`p-3 rounded-xl border ${editandoTransacao?.id === t.id ? 'border-amber-500 bg-amber-500/10' : t.tipoDivisao === 'reembolso_integral' ? 'border-cyan-400 bg-cyan-50/15' : modoEscuro ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} flex items-center justify-between shadow-sm`}>
                      <div className="pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${t.pagador === 'pequeno' ? 'bg-cyan-100 text-cyan-800' : 'bg-pink-100 text-pink-800'}`}>
                            {t.pagador === 'pequeno' ? 'Pequeno' : 'Pequena'}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">{t.categoria}</span>
                          {t.eFixoRecorrente && (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/30 flex items-center gap-0.5">
                              <Repeat className="w-2.5 h-2.5"/> Fixo
                            </span>
                          )}
                          {t.tipoDivisao === '50/50' && (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-500 font-bold border border-amber-500/30">
                              50/50
                            </span>
                          )}
                          {t.tipoDivisao === 'reembolso_integral' && (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/30">
                              Reembolso Integral (PIX)
                            </span>
                          )}
                        </div>
                        <span className="font-semibold text-xs sm:text-sm block mt-1">{t.descricao}</span>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="text-right">
                          <span className="font-bold text-xs sm:text-sm block">R$ {Number(valorExibido).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => iniciarEdicaoTransacao(t)} className="text-slate-400 hover:text-amber-500 p-1">
                            <Edit3 className="w-4 h-4"/>
                          </button>
                          <button onClick={() => removerTransacao(t)} className="text-slate-400 hover:text-rose-500 p-1">
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
