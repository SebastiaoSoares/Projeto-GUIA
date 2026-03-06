import sqlite3
import json
import secrets
from datetime import datetime
from cryptography.fernet import Fernet
import os

# Configuração de criptografia
KEY_FILE = 'secret.key'

def get_or_create_key():
    if os.path.exists(KEY_FILE):
        with open(KEY_FILE, 'rb') as key_file:
            return key_file.read()
    else:
        key = Fernet.generate_key()
        with open(KEY_FILE, 'wb') as key_file:
            key_file.write(key)
        return key

cipher = Fernet(get_or_create_key())

def dict_factory(cursor, row):
    """Converte linhas do SQLite para dicionários"""
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

def get_db():
    """Retorna uma conexão com o banco de dados"""
    conn = sqlite3.connect('guia.db')
    conn.row_factory = dict_factory
    return conn

def init_db():
    """Inicializa o banco de dados com todas as tabelas necessárias"""
    with get_db() as conn:
        # Tabela de setores
        conn.execute('''
            CREATE TABLE IF NOT EXISTS setores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT UNIQUE NOT NULL,
                descricao TEXT,
                cor TEXT DEFAULT '#FF3B30'
            )
        ''')
        
        # Tabela de colunas Kanban
        conn.execute('''
            CREATE TABLE IF NOT EXISTS colunas_kanban (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                setor_id INTEGER NOT NULL,
                ordem INTEGER NOT NULL,
                descricao TEXT,
                FOREIGN KEY(setor_id) REFERENCES setores(id)
            )
        ''')
        
        # Tabela de colaboradores
        conn.execute('''
            CREATE TABLE IF NOT EXISTS colaboradores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                cargo TEXT,
                email TEXT,
                cpf TEXT UNIQUE,
                matricula TEXT UNIQUE,
                data_inicio TEXT,
                token_acesso TEXT UNIQUE,
                token_expira TEXT,
                status TEXT DEFAULT 'ativo',
                anotacoes_criptografadas TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Tabela de cards (cada card = um colaborador em um processo)
        conn.execute('''
            CREATE TABLE IF NOT EXISTS cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                colaborador_id INTEGER NOT NULL,
                coluna_atual_id INTEGER NOT NULL,
                prioridade TEXT DEFAULT 'medium',
                observacoes_gerais TEXT,
                criado_por TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(colaborador_id) REFERENCES colaboradores(id),
                FOREIGN KEY(coluna_atual_id) REFERENCES colunas_kanban(id)
            )
        ''')
        
        # Tabela de tarefas do checklist
        conn.execute('''
            CREATE TABLE IF NOT EXISTS tarefas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_id INTEGER NOT NULL,
                coluna_kanban_id INTEGER NOT NULL,
                descricao TEXT NOT NULL,
                concluida BOOLEAN DEFAULT 0,
                concluida_por TEXT,
                concluida_em TEXT,
                ordem INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(card_id) REFERENCES cards(id),
                FOREIGN KEY(coluna_kanban_id) REFERENCES colunas_kanban(id)
            )
        ''')
        
        # Tabela de histórico de movimentações
        conn.execute('''
            CREATE TABLE IF NOT EXISTS historico_movimentacoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_id INTEGER NOT NULL,
                coluna_origem_id INTEGER,
                coluna_destino_id INTEGER NOT NULL,
                movido_por TEXT,
                movido_em TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(card_id) REFERENCES cards(id),
                FOREIGN KEY(coluna_origem_id) REFERENCES colunas_kanban(id),
                FOREIGN KEY(coluna_destino_id) REFERENCES colunas_kanban(id)
            )
        ''')
        
        # Inserir dados iniciais se estiver vazio
        popular_dados_iniciais(conn)

def popular_dados_iniciais(conn):
    """Popula o banco com dados iniciais necessários"""
    
    # Verifica se já existem setores
    setores_existentes = conn.execute('SELECT COUNT(*) as count FROM setores').fetchone()
    
    if setores_existentes['count'] == 0:
        # Inserir setores padrão
        setores = [
            ('Recursos Humanos', 'Responsável pela documentação e contratação', '#FF3B30'),
            ('Tecnologia (TI)', 'Responsável por acessos e equipamentos', '#007AFF'),
            ('SESMT', 'Saúde e Segurança do Trabalho', '#FF9500'),
            ('Gestão', 'Gestores de área e lideranças', '#34C759')
        ]
        
        for setor in setores:
            cursor = conn.execute(
                'INSERT INTO setores (nome, descricao, cor) VALUES (?, ?, ?)',
                setor
            )
            setor_id = cursor.lastrowid
            
            # Inserir colunas para cada setor
            if setor[0] == 'Recursos Humanos':
                colunas = [
                    (setor_id, '1. Documentação', 1, 'Envio e validação de documentos'),
                    (setor_id, '2. Contrato', 2, 'Assinatura do contrato de trabalho')
                ]
            elif setor[0] == 'Tecnologia (TI)':
                colunas = [
                    (setor_id, '1. Preparação de Equipamento', 1, 'Setup de notebook/desktop'),
                    (setor_id, '2. Configuração de Acessos', 2, 'Criação de e-mail e sistemas')
                ]
            elif setor[0] == 'SESMT':
                colunas = [
                    (setor_id, '1. Exames Admissionais', 1, 'Agendamento e realização de exames'),
                    (setor_id, '2. Treinamentos', 2, 'Treinamentos obrigatórios')
                ]
            elif setor[0] == 'Gestão':
                colunas = [
                    (setor_id, '1. Alinhamento Inicial', 1, 'Reunião de boas-vindas'),
                    (setor_id, '2. Integração com Time', 2, 'Apresentação ao time')
                ]
            
            for coluna in colunas:
                conn.execute(
                    'INSERT INTO colunas_kanban (setor_id, nome, ordem, descricao) VALUES (?, ?, ?, ?)',
                    coluna
                )

# ==========================================
# FUNÇÕES PARA COLABORADORES E CARDS
# ==========================================

def create_colaborador_com_card_e_tarefas(dados):
    """
    Cria um novo colaborador, seu card e tarefas iniciais
    dados: {
        'nome': str,
        'cargo': str,
        'cpf': str,
        'email': str,
        'matricula': str,
        'data_inicio': str,
        'coluna_inicial_id': int,
        'prioridade': str,
        'tarefas_iniciais': [{'descricao': str, 'coluna_id': int}, ...]
    }
    """
    try:
        with get_db() as conn:
            # 1. Gerar token único
            token = secrets.token_urlsafe(16)
            token_expira = datetime.now().isoformat()  # Simplificado
            
            # 2. Inserir colaborador
            cursor = conn.execute('''
                INSERT INTO colaboradores 
                (nome, cargo, email, cpf, matricula, data_inicio, token_acesso, token_expira)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                dados['nome'], 
                dados.get('cargo', ''),
                dados.get('email', ''),
                dados.get('cpf', ''),
                dados.get('matricula', ''),
                dados.get('data_inicio', datetime.now().strftime('%Y-%m-%d')),
                token,
                token_expira
            ))
            colaborador_id = cursor.lastrowid
            
            # 3. Inserir card
            cursor = conn.execute('''
                INSERT INTO cards 
                (colaborador_id, coluna_atual_id, prioridade, observacoes_gerais, criado_por)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                colaborador_id,
                dados['coluna_inicial_id'],
                dados.get('prioridade', 'medium'),
                dados.get('observacoes', ''),
                dados.get('criado_por', 'RH')
            ))
            card_id = cursor.lastrowid
            
            # 4. Inserir tarefas iniciais
            for tarefa in dados.get('tarefas_iniciais', []):
                conn.execute('''
                    INSERT INTO tarefas 
                    (card_id, coluna_kanban_id, descricao, ordem)
                    VALUES (?, ?, ?, ?)
                ''', (
                    card_id,
                    tarefa['coluna_id'],
                    tarefa['descricao'],
                    tarefa.get('ordem', 0)
                ))
            
            # 5. Registrar movimentação inicial
            conn.execute('''
                INSERT INTO historico_movimentacoes 
                (card_id, coluna_destino_id, movido_por)
                VALUES (?, ?, ?)
            ''', (card_id, dados['coluna_inicial_id'], 'Sistema'))
            
            return {
                'success': True,
                'card_id': card_id,
                'colaborador_id': colaborador_id,
                'token': token
            }
            
    except Exception as e:
        print(f"Erro ao criar colaborador: {e}")
        return {'success': False, 'error': str(e)}

def get_all_tasks():
    """Retorna todos os cards com informações básicas"""
    with get_db() as conn:
        cards = conn.execute('''
            SELECT 
                c.id,
                col.nome as nome_colaborador,
                col.cargo,
                c.prioridade,
                c.observacoes_gerais,
                c.coluna_atual_id,
                ck.nome as coluna_nome,
                s.nome as setor_nome,
                s.cor as setor_cor,
                (SELECT COUNT(*) FROM tarefas WHERE card_id = c.id) as total_tarefas,
                (SELECT COUNT(*) FROM tarefas WHERE card_id = c.id AND concluida = 1) as tarefas_concluidas
            FROM cards c
            JOIN colaboradores col ON c.colaborador_id = col.id
            JOIN colunas_kanban ck ON c.coluna_atual_id = ck.id
            JOIN setores s ON ck.setor_id = s.id
            WHERE col.status = 'ativo'
            ORDER BY c.created_at DESC
        ''').fetchall()
        
        # Formatar para o front-end
        tasks = []
        for card in cards:
            tasks.append({
                'id': card['id'],
                'title': card['nome_colaborador'],
                'description': card['observacoes_gerais'] or f"Cargo: {card['cargo']}",
                'priority': card['prioridade'],
                'department': card['setor_nome'].lower().replace(' ', '_'),
                'status': card['coluna_atual_id'],
                'progress': round((card['tarefas_concluidas'] / max(card['total_tarefas'], 1)) * 100),
                'total_tarefas': card['total_tarefas'],
                'tarefas_concluidas': card['tarefas_concluidas']
            })
        
        return tasks

def get_card_com_tarefas_e_colaborador(card_id):
    """Retorna detalhes completos de um card"""
    with get_db() as conn:
        card = conn.execute('''
            SELECT 
                c.*,
                col.nome as colaborador_nome,
                col.cargo,
                col.email,
                col.cpf,
                col.matricula,
                col.data_inicio,
                col.token_acesso,
                ck.nome as coluna_nome,
                ck.setor_id,
                s.nome as setor_nome
            FROM cards c
            JOIN colaboradores col ON c.colaborador_id = col.id
            JOIN colunas_kanban ck ON c.coluna_atual_id = ck.id
            JOIN setores s ON ck.setor_id = s.id
            WHERE c.id = ?
        ''', (card_id,)).fetchone()
        
        if not card:
            return None
        
        # Buscar tarefas do card
        tarefas = conn.execute('''
            SELECT 
                t.*,
                ck.nome as coluna_nome,
                s.nome as setor_nome
            FROM tarefas t
            JOIN colunas_kanban ck ON t.coluna_kanban_id = ck.id
            JOIN setores s ON ck.setor_id = s.id
            WHERE t.card_id = ?
            ORDER BY ck.ordem, t.ordem
        ''', (card_id,)).fetchall()
        
        # Buscar histórico
        historico = conn.execute('''
            SELECT 
                h.*,
                co.nome as coluna_origem_nome,
                cd.nome as coluna_destino_nome
            FROM historico_movimentacoes h
            LEFT JOIN colunas_kanban co ON h.coluna_origem_id = co.id
            JOIN colunas_kanban cd ON h.coluna_destino_id = cd.id
            WHERE h.card_id = ?
            ORDER BY h.movido_em DESC
            LIMIT 10
        ''', (card_id,)).fetchall()
        
        # Descriptografar anotações se existirem
        anotacoes = None
        if card.get('anotacoes_criptografadas'):
            try:
                anotacoes = cipher.decrypt(
                    card['anotacoes_criptografadas'].encode()
                ).decode()
            except:
                anotacoes = "Erro ao descriptografar"
        
        return {
            'card': card,
            'tarefas': tarefas,
            'historico': historico,
            'anotacoes': anotacoes
        }

def update_task_status(card_id, nova_coluna_id):
    """Atualiza a coluna atual de um card"""
    try:
        with get_db() as conn:
            # Buscar coluna atual
            card_atual = conn.execute(
                'SELECT coluna_atual_id FROM cards WHERE id = ?', 
                (card_id,)
            ).fetchone()
            
            if not card_atual:
                return False
            
            coluna_origem_id = card_atual['coluna_atual_id']
            
            # Atualizar card
            conn.execute('''
                UPDATE cards 
                SET coluna_atual_id = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (nova_coluna_id, card_id))
            
            # Registrar movimentação
            conn.execute('''
                INSERT INTO historico_movimentacoes 
                (card_id, coluna_origem_id, coluna_destino_id, movido_por)
                VALUES (?, ?, ?, ?)
            ''', (card_id, coluna_origem_id, nova_coluna_id, 'Usuário'))
            
            return True
    except Exception as e:
        print(f"Erro ao atualizar status: {e}")
        return False

def delete_task(card_id):
    """Arquiva um card (soft delete)"""
    try:
        with get_db() as conn:
            conn.execute('''
                UPDATE colaboradores 
                SET status = 'arquivado' 
                WHERE id = (SELECT colaborador_id FROM cards WHERE id = ?)
            ''', (card_id,))
            return True
    except Exception as e:
        print(f"Erro ao arquivar: {e}")
        return False

# ==========================================
# FUNÇÕES PARA TAREFAS
# ==========================================

def update_tarefa_status(tarefa_id, concluida):
    """Atualiza o status de conclusão de uma tarefa"""
    try:
        with get_db() as conn:
            if concluida:
                conn.execute('''
                    UPDATE tarefas 
                    SET concluida = 1, 
                        concluida_em = CURRENT_TIMESTAMP,
                        concluida_por = ?
                    WHERE id = ?
                ''', ('Usuário', tarefa_id))
            else:
                conn.execute('''
                    UPDATE tarefas 
                    SET concluida = 0, 
                        concluida_em = NULL,
                        concluida_por = NULL
                    WHERE id = ?
                ''', (tarefa_id,))
            return True
    except Exception as e:
        print(f"Erro ao atualizar tarefa: {e}")
        return False

# ==========================================
# FUNÇÕES PARA ONBOARDING DO COLABORADOR
# ==========================================

def get_colaborador_by_token(token):
    """Retorna dados do colaborador baseado no token"""
    with get_db() as conn:
        return conn.execute('''
            SELECT * FROM colaboradores 
            WHERE token_acesso = ? AND status = 'ativo'
        ''', (token,)).fetchone()

def get_onboarding_data_by_token(token):
    """Retorna dados de onboarding para o colaborador"""
    with get_db() as conn:
        # Buscar colaborador
        colaborador = conn.execute('''
            SELECT * FROM colaboradores WHERE token_acesso = ?
        ''', (token,)).fetchone()
        
        if not colaborador:
            return None
        
        # Buscar card ativo do colaborador
        card = conn.execute('''
            SELECT * FROM cards 
            WHERE colaborador_id = ?
            ORDER BY created_at DESC LIMIT 1
        ''', (colaborador['id'],)).fetchone()
        
        if not card:
            return None
        
        # Buscar todas as tarefas do colaborador
        tarefas = conn.execute('''
            SELECT 
                t.*,
                ck.nome as etapa_nome,
                ck.setor_id,
                s.nome as setor_nome
            FROM tarefas t
            JOIN colunas_kanban ck ON t.coluna_kanban_id = ck.id
            JOIN setores s ON ck.setor_id = s.id
            WHERE t.card_id = ?
            ORDER BY ck.ordem, t.ordem
        ''', (card['id'],)).fetchall()
        
        # Calcular progresso
        total_tarefas = len(tarefas)
        tarefas_concluidas = sum(1 for t in tarefas if t['concluida'])
        progresso = round((tarefas_concluidas / max(total_tarefas, 1)) * 100)
        
        # Descriptografar anotações
        anotacoes = None
        if colaborador.get('anotacoes_criptografadas'):
            try:
                anotacoes = cipher.decrypt(
                    colaborador['anotacoes_criptografadas'].encode()
                ).decode()
            except:
                anotacoes = "Erro ao descriptografar"
        
        return {
            'colaborador': colaborador,
            'card': card,
            'tarefas': tarefas,
            'progresso': progresso,
            'total_tarefas': total_tarefas,
            'tarefas_concluidas': tarefas_concluidas,
            'anotacoes': anotacoes
        }

def add_anotacao_criptografada(token, anotacao):
    """Adiciona/atualiza anotação criptografada do colaborador"""
    try:
        anotacao_criptografada = cipher.encrypt(anotacao.encode()).decode()
        
        with get_db() as conn:
            conn.execute('''
                UPDATE colaboradores 
                SET anotacoes_criptografadas = ?
                WHERE token_acesso = ?
            ''', (anotacao_criptografada, token))
            return True
    except Exception as e:
        print(f"Erro ao salvar anotação: {e}")
        return False

def verify_token(token):
    """Verifica se um token é válido"""
    with get_db() as conn:
        result = conn.execute('''
            SELECT id FROM colaboradores 
            WHERE token_acesso = ? AND status = 'ativo'
        ''', (token,)).fetchone()
        return result is not None

# ==========================================
# FUNÇÕES PARA COLUNAS E ESTATÍSTICAS
# ==========================================

def get_all_colunas_com_setores():
    """Retorna todas as colunas com seus respectivos setores"""
    with get_db() as conn:
        colunas = conn.execute('''
            SELECT 
                ck.*,
                s.nome as setor_nome,
                s.cor as setor_cor,
                (SELECT COUNT(*) FROM cards WHERE coluna_atual_id = ck.id) as total_cards
            FROM colunas_kanban ck
            JOIN setores s ON ck.setor_id = s.id
            ORDER BY s.ordem, ck.ordem
        ''').fetchall()
        return colunas

def get_dashboard_stats():
    """Retorna estatísticas para o dashboard"""
    with get_db() as conn:
        total_colaboradores = conn.execute('''
            SELECT COUNT(*) as count FROM colaboradores WHERE status = 'ativo'
        ''').fetchone()['count']
        
        total_cards = conn.execute('''
            SELECT COUNT(*) as count FROM cards c
            JOIN colaboradores col ON c.colaborador_id = col.id
            WHERE col.status = 'ativo'
        ''').fetchone()['count']
        
        cards_por_setor = conn.execute('''
            SELECT 
                s.nome as setor,
                s.cor,
                COUNT(c.id) as total
            FROM setores s
            LEFT JOIN colunas_kanban ck ON s.id = ck.setor_id
            LEFT JOIN cards c ON c.coluna_atual_id = ck.id
            LEFT JOIN colaboradores col ON c.colaborador_id = col.id AND col.status = 'ativo'
            GROUP BY s.id
        ''').fetchall()
        
        tarefas_pendentes = conn.execute('''
            SELECT COUNT(*) as count FROM tarefas WHERE concluida = 0
        ''').fetchone()['count']
        
        tarefas_concluidas = conn.execute('''
            SELECT COUNT(*) as count FROM tarefas WHERE concluida = 1
        ''').fetchone()['count']
        
        total_tarefas = tarefas_pendentes + tarefas_concluidas
        progresso_geral = round((tarefas_concluidas / max(total_tarefas, 1)) * 100)
        
        return {
            'total_colaboradores': total_colaboradores,
            'total_cards': total_cards,
            'cards_por_setor': cards_por_setor,
            'tarefas_pendentes': tarefas_pendentes,
            'tarefas_concluidas': tarefas_concluidas,
            'progresso_geral': progresso_geral
        }