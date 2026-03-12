class ApiService {
    constructor() {
        this.baseUrl = '/api';
    }

    async getColunas() {
        try {
            const response = await fetch(`${this.baseUrl}/colunas`);
            return await response.json();
        } catch (error) {
            console.error('Erro ao carregar colunas:', error);
            return [];
        }
    }

    async getColaboradores() {
        try {
            const response = await fetch(`${this.baseUrl}/colaboradores`);
            return await response.json();
        } catch (error) {
            console.error('Erro ao carregar colaboradores:', error);
            return [];
        }
    }

    async criarColaborador(dados) {
        try {
            const response = await fetch(`${this.baseUrl}/colaboradores`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dados)
            });
            return response.ok;
        } catch (error) {
            console.error('Erro ao criar colaborador:', error);
            return false;
        }
    }

    async moverCard(colaboradorId, novaColunaId) {
        try {
            const response = await fetch(`${this.baseUrl}/mover_card`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    colaborador_id: colaboradorId,
                    nova_coluna_id: novaColunaId
                })
            });
            return response.ok;
        } catch (error) {
            console.error('Erro ao mover card:', error);
            return false;
        }
    }

    // --- NOVAS FUNÇÕES PARA O CHECKLIST PADRÃO ---
    
    async getChecklists(colunaId) {
        try {
            const response = await fetch(`${this.baseUrl}/colunas/${colunaId}/checklists`);
            if (!response.ok) throw new Error('Erro ao buscar checklists');
            return await response.json();
        } catch (error) {
            console.error(error);
            return [];
        }
    }

    async createChecklist(colunaId, dados) {
        try {
            const response = await fetch(`${this.baseUrl}/colunas/${colunaId}/checklists`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dados)
            });
            return response.ok;
        } catch (error) {
            console.error('Erro ao criar checklist:', error);
            return false;
        }
    }

    async deleteChecklist(checklistId) {
        try {
            const response = await fetch(`${this.baseUrl}/checklists/${checklistId}`, {
                method: 'DELETE'
            });
            return response.ok;
        } catch (error) {
            console.error('Erro ao deletar checklist:', error);
            return false;
        }
    }
}

// Instância global para ser usada em outros arquivos
window.apiService = new ApiService();