const ApiService = {
    // ==========================================
    // CARDS E TAREFAS
    // ==========================================
    
    async getTasks() {
        try {
            const response = await fetch('/api/tasks');
            if (!response.ok) throw new Error('Falha ao buscar tarefas');
            return await response.json();
        } catch (error) {
            console.error("Erro na API:", error);
            showNotification('Erro ao carregar dados do servidor', 'error');
            return [];
        }
    },

    async createTask(taskData) {
        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });
            const result = await response.json();
            
            if (result.success && result.token) {
                showNotification(`Token de acesso gerado: ${result.token}`, 'success', 10000);
                // Copiar token para área de transferência
                navigator.clipboard?.writeText(result.token);
            }
            
            return result;
        } catch (error) {
            console.error("Erro ao criar:", error);
            showNotification('Erro ao criar colaborador', 'error');
            return { success: false };
        }
    },

    async getCardDetalhes(cardId) {
        try {
            const response = await fetch(`/api/cards/${cardId}`);
            if (!response.ok) throw new Error('Card não encontrado');
            return await response.json();
        } catch (error) {
            console.error("Erro ao buscar detalhes:", error);
            showNotification('Erro ao carregar detalhes do card', 'error');
            return null;
        }
    },

    async updateTaskStatus(taskId, newColunaId) {
        try {
            const response = await fetch(`/api/tasks/${taskId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ coluna_id: newColunaId })
            });
            return await response.json();
        } catch (error) {
            console.error("Erro ao atualizar status:", error);
            showNotification('Erro ao mover colaborador', 'error');
            return { success: false };
        }
    },

    async deleteTask(taskId) {
        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'DELETE'
            });
            return await response.json();
        } catch (error) {
            console.error("Erro ao deletar:", error);
            showNotification('Erro ao arquivar colaborador', 'error');
            return { success: false };
        }
    },

    // ==========================================
    // TAREFAS INDIVIDUAIS
    // ==========================================

    async toggleTarefa(tarefaId, concluida) {
        try {
            const response = await fetch(`/api/tarefas/${tarefaId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ concluida: concluida })
            });
            return await response.json();
        } catch (error) {
            console.error("Erro ao atualizar tarefa:", error);
            showNotification('Erro ao marcar tarefa', 'error');
            return { success: false };
        }
    },

    // ==========================================
    // COLUNAS KANBAN
    // ==========================================

    async getColunas() {
        try {
            const response = await fetch('/api/colunas');
            return await response.json();
        } catch (error) {
            console.error("Erro ao buscar colunas:", error);
            return [];
        }
    },

    // ==========================================
    // ONBOARDING DO COLABORADOR
    // ==========================================

    async getMeuOnboarding(token) {
        try {
            const response = await fetch(`/api/meu-onboarding?token=${token}`);
            if (!response.ok) throw new Error('Token inválido');
            return await response.json();
        } catch (error) {
            console.error("Erro ao buscar onboarding:", error);
            showNotification('Erro ao carregar seus dados', 'error');
            return null;
        }
    },

    async salvarAnotacao(token, anotacao) {
        try {
            const response = await fetch('/api/anotacoes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, anotacao })
            });
            return await response.json();
        } catch (error) {
            console.error("Erro ao salvar anotação:", error);
            showNotification('Erro ao salvar anotação', 'error');
            return { success: false };
        }
    },

    // ==========================================
    // ESTATÍSTICAS
    // ==========================================

    async getDashboardStats() {
        try {
            const response = await fetch('/api/dashboard/stats');
            return await response.json();
        } catch (error) {
            console.error("Erro ao buscar stats:", error);
            return null;
        }
    }
};

// Função de notificação global
function showNotification(message, type = 'info', duration = 5000) {
    // Remove notificações existentes
    const existing = document.querySelectorAll('.custom-notification');
    existing.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `custom-notification notification-${type}`;
    
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'error' ? 'exclamation-circle' : 'info-circle';
    
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close"><i class="fas fa-times"></i></button>
    `;
    
    // Estilos
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${type === 'success' ? '#34C759' : type === 'error' ? '#FF3B30' : '#007AFF'};
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 15px;
        z-index: 9999;
        animation: slideInRight 0.3s ease;
        max-width: 400px;
    `;
    
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.remove();
    });
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (document.body.contains(notification)) {
            notification.remove();
        }
    }, duration);
}

// Tornar função global
window.showNotification = showNotification;
window.ApiService = ApiService;