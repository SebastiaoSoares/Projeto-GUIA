#!/usr/bin/env python3
"""
Script para criar usuários gestores no sistema GUIA
Execute: python criar_gestor.py
"""

import sqlite3
import hashlib
import secrets
from getpass import getpass
import os

def criar_tabela_usuarios():
    """Cria a tabela de usuários se não existir"""
    conn = sqlite3.connect('guia.db')
    cursor = conn.cursor()
    
    # Criar tabela de usuários do sistema
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS usuarios_sistema (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha_hash TEXT NOT NULL,
            role TEXT DEFAULT 'gestor',
            setor_id INTEGER,
            ativo BOOLEAN DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            ultimo_acesso TEXT,
            FOREIGN KEY(setor_id) REFERENCES setores(id)
        )
    ''')
    
    # Criar tabela de sessões
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expira_em TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(usuario_id) REFERENCES usuarios_sistema(id)
        )
    ''')
    
    conn.commit()
    conn.close()
    print("✅ Tabelas de usuários verificadas/criadas")

def hash_senha(senha):
    """Cria hash da senha usando SHA-256 + salt"""
    salt = secrets.token_hex(16)
    hash_obj = hashlib.sha256((senha + salt).encode())
    return f"{salt}${hash_obj.hexdigest()}"

def verificar_senha(senha, hash_completo):
    """Verifica se a senha corresponde ao hash"""
    salt, hash_real = hash_completo.split('$')
    hash_verificar = hashlib.sha256((senha + salt).encode()).hexdigest()
    return hash_verificar == hash_real

def listar_setores():
    """Lista os setores disponíveis no sistema"""
    conn = sqlite3.connect('guia.db')
    cursor = conn.cursor()
    
    cursor.execute('SELECT id, nome FROM setores ORDER BY id')
    setores = cursor.fetchall()
    
    conn.close()
    return setores

def criar_gestor_interativo():
    """Cria um novo gestor de forma interativa"""
    
    print("\n" + "="*50)
    print("👤  CRIAR NOVO USUÁRIO GESTOR  👤")
    print("="*50)
    
    # Listar setores disponíveis
    setores = listar_setores()
    
    if not setores:
        print("\n⚠️  Nenhum setor encontrado! Criando setores padrão...")
        criar_setores_padrao()
        setores = listar_setores()
    
    print("\n📋 Setores disponíveis:")
    for setor in setores:
        print(f"   {setor[0]}. {setor[1]}")
    
    # Coletar dados do usuário
    print("\n📝 Preencha os dados do gestor:")
    
    nome = input("Nome completo: ").strip()
    while not nome:
        print("❌ Nome não pode estar vazio!")
        nome = input("Nome completo: ").strip()
    
    email = input("Email: ").strip().lower()
    while not email or '@' not in email:
        print("❌ Email inválido!")
        email = input("Email: ").strip().lower()
    
    # Escolher setor
    try:
        setor_id = int(input(f"ID do setor (1-{len(setores)}): ").strip())
        setor_valido = any(s[0] == setor_id for s in setores)
        while not setor_valido:
            print(f"❌ Setor inválido! Escolha entre 1 e {len(setores)}")
            setor_id = int(input(f"ID do setor: ").strip())
            setor_valido = any(s[0] == setor_id for s in setores)
    except ValueError:
        print("❌ Valor inválido! Usando setor padrão (1)")
        setor_id = 1
    
    # Definir papel (role)
    print("\n👑 Níveis de acesso:")
    print("   1. Gestor (acesso total)")
    print("   2. Visualizador (apenas leitura)")
    print("   3. Administrador (acesso completo + config)")
    
    try:
        role_opcao = int(input("Nível de acesso (1-3) [padrão=1]: ").strip() or "1")
        roles = {1: 'gestor', 2: 'visualizador', 3: 'admin'}
        role = roles.get(role_opcao, 'gestor')
    except ValueError:
        role = 'gestor'
    
    # Senha
    print("\n🔐 Defina a senha:")
    senha1 = getpass("Senha: ")
    senha2 = getpass("Confirme a senha: ")
    
    while senha1 != senha2 or len(senha1) < 6:
        if len(senha1) < 6:
            print("❌ A senha deve ter pelo menos 6 caracteres!")
        else:
            print("❌ As senhas não coincidem!")
        senha1 = getpass("Senha: ")
        senha2 = getpass("Confirme a senha: ")
    
    # Criar o usuário
    sucesso, mensagem = salvar_gestor(nome, email, senha1, setor_id, role)
    
    if sucesso:
        print("\n" + "✅"*15)
        print("🎉 USUÁRIO GESTOR CRIADO COM SUCESSO!")
        print("✅"*15)
        print(f"\n📧 Email: {email}")
        print(f"👤 Nome: {nome}")
        print(f"🏢 Setor ID: {setor_id}")
        print(f"👑 Nível: {role}")
        print("\n🔑 Use estas credenciais para fazer login no sistema!")
    else:
        print(f"\n❌ Erro: {mensagem}")

def salvar_gestor(nome, email, senha, setor_id, role='gestor'):
    """Salva o gestor no banco de dados"""
    try:
        conn = sqlite3.connect('guia.db')
        cursor = conn.cursor()
        
        # Verificar se email já existe
        cursor.execute('SELECT id FROM usuarios_sistema WHERE email = ?', (email,))
        if cursor.fetchone():
            conn.close()
            return False, "Email já cadastrado!"
        
        # Criar hash da senha
        senha_hash = hash_senha(senha)
        
        # Inserir usuário
        cursor.execute('''
            INSERT INTO usuarios_sistema 
            (nome, email, senha_hash, role, setor_id)
            VALUES (?, ?, ?, ?, ?)
        ''', (nome, email, senha_hash, role, setor_id))
        
        usuario_id = cursor.lastrowid
        
        conn.commit()
        conn.close()
        
        return True, f"Usuário criado com ID: {usuario_id}"
        
    except sqlite3.IntegrityError:
        return False, "Email já cadastrado!"
    except Exception as e:
        return False, f"Erro: {str(e)}"

def criar_setores_padrao():
    """Cria setores padrão se não existirem"""
    conn = sqlite3.connect('guia.db')
    cursor = conn.cursor()
    
    setores_padrao = [
        ('Recursos Humanos', 'Responsável por contratações e documentação', '#FF3B30'),
        ('Tecnologia (TI)', 'Responsável por acessos e equipamentos', '#007AFF'),
        ('SESMT', 'Saúde e segurança do trabalho', '#FF9500'),
        ('Gestão', 'Gestores e lideranças', '#34C759'),
        ('Administração', 'Administradores do sistema', '#AF52DE')
    ]
    
    for setor in setores_padrao:
        try:
            cursor.execute('''
                INSERT OR IGNORE INTO setores (nome, descricao, cor)
                VALUES (?, ?, ?)
            ''', setor)
        except:
            pass
    
    conn.commit()
    conn.close()
    print("✅ Setores padrão criados!")

def listar_gestores():
    """Lista todos os gestores cadastrados"""
    conn = sqlite3.connect('guia.db')
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT u.id, u.nome, u.email, u.role, s.nome as setor, u.ativo
        FROM usuarios_sistema u
        LEFT JOIN setores s ON u.setor_id = s.id
        ORDER BY u.id
    ''')
    
    usuarios = cursor.fetchall()
    conn.close()
    
    if usuarios:
        print("\n" + "="*60)
        print("📋  USUÁRIOS GESTORES CADASTRADOS")
        print("="*60)
        for user in usuarios:
            status = "✅" if user[5] else "❌"
            print(f"{status} ID: {user[0]} | {user[1]} | {user[2]} | {user[3]} | {user[4]}")
    else:
        print("\n📭 Nenhum usuário gestor cadastrado ainda.")
    
    return usuarios

def resetar_senha():
    """Resetar senha de um usuário"""
    usuarios = listar_gestores()
    
    if not usuarios:
        return
    
    try:
        user_id = int(input("\nID do usuário para resetar senha: "))
        
        # Verificar se usuário existe
        conn = sqlite3.connect('guia.db')
        cursor = conn.cursor()
        cursor.execute('SELECT nome FROM usuarios_sistema WHERE id = ?', (user_id,))
        usuario = cursor.fetchone()
        
        if not usuario:
            print("❌ Usuário não encontrado!")
            conn.close()
            return
        
        print(f"\n🔄 Resetando senha para: {usuario[0]}")
        nova_senha = getpass("Nova senha: ")
        confirma = getpass("Confirme a nova senha: ")
        
        if nova_senha != confirma:
            print("❌ As senhas não coincidem!")
            conn.close()
            return
        
        senha_hash = hash_senha(nova_senha)
        
        cursor.execute('''
            UPDATE usuarios_sistema 
            SET senha_hash = ? 
            WHERE id = ?
        ''', (senha_hash, user_id))
        
        conn.commit()
        conn.close()
        print("✅ Senha alterada com sucesso!")
        
    except ValueError:
        print("❌ ID inválido!")

def menu_principal():
    """Menu principal do script"""
    
    # Garantir que as tabelas existem
    criar_tabela_usuarios()
    
    while True:
        print("\n" + "="*50)
        print("🔧  GUIA - GESTÃO DE USUÁRIOS  🔧")
        print("="*50)
        print("1. 👤 Criar novo gestor")
        print("2. 📋 Listar todos os gestores")
        print("3. 🔑 Resetar senha de gestor")
        print("4. 🚪 Sair")
        print("="*50)
        
        opcao = input("\nEscolha uma opção: ").strip()
        
        if opcao == '1':
            criar_gestor_interativo()
        elif opcao == '2':
            listar_gestores()
        elif opcao == '3':
            resetar_senha()
        elif opcao == '4':
            print("\n👋 Até logo!")
            break
        else:
            print("❌ Opção inválida!")

# ==========================================
# FUNÇÕES PARA INTEGRAR COM O APP.PY
# ==========================================

def autenticar_gestor(email, senha):
    """Autentica um gestor (para usar no app.py)"""
    conn = sqlite3.connect('guia.db')
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, nome, senha_hash, role, setor_id, ativo
        FROM usuarios_sistema 
        WHERE email = ? AND ativo = 1
    ''', (email,))
    
    usuario = cursor.fetchone()
    conn.close()
    
    if not usuario:
        return None
    
    # Verificar senha
    hash_completo = usuario[2]
    salt, hash_real = hash_completo.split('$')
    hash_verificar = hashlib.sha256((senha + salt).encode()).hexdigest()
    
    if hash_verificar == hash_real:
        return {
            'id': usuario[0],
            'nome': usuario[1],
            'role': usuario[3],
            'setor_id': usuario[4]
        }
    
    return None

def criar_token_sessao(usuario_id):
    """Cria um token de sessão para o usuário"""
    import secrets
    from datetime import datetime, timedelta
    
    token = secrets.token_urlsafe(32)
    expira_em = (datetime.now() + timedelta(days=7)).isoformat()
    
    conn = sqlite3.connect('guia.db')
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO sessoes (usuario_id, token, expira_em)
        VALUES (?, ?, ?)
    ''', (usuario_id, token, expira_em))
    
    conn.commit()
    conn.close()
    
    return token

def verificar_token_sessao(token):
    """Verifica se um token de sessão é válido"""
    from datetime import datetime
    
    conn = sqlite3.connect('guia.db')
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT s.usuario_id, u.nome, u.role, s.expira_em
        FROM sessoes s
        JOIN usuarios_sistema u ON s.usuario_id = u.id
        WHERE s.token = ? AND u.ativo = 1
    ''', (token,))
    
    sessao = cursor.fetchone()
    conn.close()
    
    if not sessao:
        return None
    
    # Verificar se não expirou
    expira_em = datetime.fromisoformat(sessao[3])
    if datetime.now() > expira_em:
        return None
    
    return {
        'usuario_id': sessao[0],
        'nome': sessao[1],
        'role': sessao[2]
    }

if __name__ == '__main__':
    try:
        menu_principal()
    except KeyboardInterrupt:
        print("\n\n👋 Operação cancelada pelo usuário.")
    except Exception as e:
        print(f"\n❌ Erro inesperado: {e}")