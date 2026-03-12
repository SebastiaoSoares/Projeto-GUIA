class KanbanBoard {
    constructor() {
        this.board = document.querySelector('.kanban-columns');
        this.api = window.apiService;
        this.colunas = [];
        this.colaboradores = [];
        this.draggedCard = null;
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
    }

    async loadData() {
        this.colunas = await this.api.getColunas();
        this.colaboradores = await this.api.getColaboradores();
        this.renderBoard();
        this.updateStats();
    }

    renderBoard() {
        this.board.innerHTML = '';
        
        if (this.colunas.length === 0) {
            this.board.innerHTML = '<div style="padding: 40px; text-align: center; color: #999; width: 100%;">Nenhuma coluna configurada para sua empresa.</div>';
            return;
        }

        this.colunas.forEach(coluna => {
            const cardsNaColuna = this.colaboradores.filter(c => c.coluna_id === coluna.id);
            
            const columnEl = document.createElement('div');
            columnEl.className = 'kanban-column';
            columnEl.setAttribute('data-column-id', coluna.id);
            
            columnEl.innerHTML = `
                <div class="column-header">
                    <h3>
                        <span style="width: 12px; height: 12px; border-radius: 50%; background: ${coluna.cor_hex}"></span>
                        ${coluna.nome}
                    </h3>
                    <div class="column-header-actions">
                        <span class="column-count">${cardsNaColuna.length}</span>
                        <!-- NOVO BOTÃO DE ENGRENAGEM -->
                        <button class="btn-config-col" onclick="window.kanbanBoard.openChecklistsModal(${coluna.id}, '${coluna.nome}')" title="Configurar Tarefas Padrão">
                            <i class="fas fa-cog"></i>
                        </button>
                    </div>
                </div>
                <div class="tasks-container" data-column-id="${coluna.id}">
                    ${cardsNaColuna.map(c => this.createCardHTML(c, coluna.cor_hex)).join('')}
                </div>
            `;
            
            this.board.appendChild(columnEl);
        });
        
        this.setupDragAndDrop();
    }

    createCardHTML(colaborador, corHex) {
        const iniciais = colaborador.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        
        return `
            <div class="task-card" draggable="true" data-card-id="${colaborador.id}" style="border-left-color: ${corHex}">
                <div class="task-header">
                    <div class="task-tags">
                        <span class="task-tag" style="background: ${corHex}20; color: ${corHex}">
                            ${colaborador.departamento}
                        </span>
                    </div>
                    <div class="task-actions">
                        <button class="task-action-btn" title="Ver Detalhes">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
                
                <h4 class="task-title">${colaborador.nome}</h4>
                <p class="task-description">${colaborador.cargo}</p>
                
                <div class="task-footer">
                    <div class="task-assignee">
                        <div class="assignee-avatar">${iniciais}</div>
                        <span class="assignee-name">Token: ${colaborador.token}</span>
                    </div>
                </div>
            </div>
        `;
    }

    setupDragAndDrop() {
        const cards = document.querySelectorAll('.task-card');
        const containers = document.querySelectorAll('.tasks-container');

        cards.forEach(card => {
            card.addEventListener('dragstart', () => {
                this.draggedCard = card;
                card.classList.add('dragging');
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                this.draggedCard = null;
            });
        });

        containers.forEach(container => {
            container.addEventListener('dragover', e => {
                e.preventDefault();
                container.classList.add('drag-over');
                
                const afterElement = this.getDragAfterElement(container, e.clientY);
                if (afterElement == null) {
                    container.appendChild(this.draggedCard);
                } else {
                    container.insertBefore(this.draggedCard, afterElement);
                }
            });

            container.addEventListener('dragleave', () => {
                container.classList.remove('drag-over');
            });

            container.addEventListener('drop', async e => {
                e.preventDefault();
                container.classList.remove('drag-over');
                
                const cardId = this.draggedCard.getAttribute('data-card-id');
                const novaColunaId = container.getAttribute('data-column-id');
                
                // Atualiza na API
                const success = await this.api.moverCard(cardId, novaColunaId);
                if (success) {
                    await this.loadData(); // Recarrega para atualizar contadores e banco
                }
            });
        });
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    async createNewTask(formElement) {
        const formData = new FormData(formElement);
        const dados = {
            nome: formData.get('nome'),
            cargo: formData.get('cargo'),
            departamento: formData.get('departamento'),
            email: formData.get('email')
        };

        const success = await this.api.criarColaborador(dados);
        if (success) {
            await this.loadData();
        }
        return success;
    }

    updateStats() {
        const countElements = document.querySelectorAll('.column-count');
        if (countElements.length > 0 && this.colaboradores) {
            // Atualiza o card de estatística global (o primeiro com a classe column-count no DOM é o card de stats)
            const globalStat = document.querySelector('.stat-info .column-count');
            if (globalStat) {
                globalStat.textContent = this.colaboradores.length;
            }
        }
    }

    // --- LÓGICA DO MODAL DE CHECKLISTS ---
    
    async openChecklistsModal(colunaId, colunaNome) {
        document.getElementById('currentColunaId').value = colunaId;
        document.getElementById('checklistModalTitle').innerHTML = `<i class="fas fa-list-check" style="color: #FF3B30;"></i> Tarefas Padrão - ${colunaNome}`;
        document.getElementById('checklistsModal').style.display = 'flex';
        await this.loadChecklists(colunaId);
    }

    async loadChecklists(colunaId) {
        const listContainer = document.getElementById('checklistsList');
        listContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Carregando tarefas...</p>';
        
        const checklists = await this.api.getChecklists(colunaId);
        listContainer.innerHTML = '';
        
        if (checklists.length === 0) {
            listContainer.innerHTML = '<div style="text-align: center; padding: 20px; background: #FFF; border-radius: 8px; border: 1px dashed #CCC;"><p style="color: #999; font-size: 0.9rem;">Nenhuma tarefa configurada para esta coluna.</p></div>';
            return;
        }
        
        checklists.forEach(item => {
            const div = document.createElement('div');
            div.className = 'checklist-item';
            div.innerHTML = `
                <div class="checklist-item-info">
                    <strong><i class="fas fa-check-circle" style="color: #34C759; margin-right: 5px;"></i> ${item.titulo}</strong>
                    <small>${item.descricao || 'Nenhuma descrição detalhada.'}</small>
                </div>
                <button class="btn-delete-checklist" onclick="window.kanbanBoard.deleteChecklist(${item.id}, ${colunaId})" title="Remover Tarefa">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            listContainer.appendChild(div);
        });
    }

    async deleteChecklist(checklistId, colunaId) {
        if (confirm('Tem certeza que deseja remover esta tarefa padrão? Ela não será mais gerada para novos colaboradores nesta coluna.')) {
            const success = await window.apiService.deleteChecklist(checklistId);
            if (success) {
                await this.loadChecklists(colunaId);
            } else {
                alert('Erro ao excluir a tarefa.');
            }
        }
    }

    setupEventListeners() {
        // Eventos adicionais se necessários
    }
}

// Inicializa o Kanban quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.kanbanBoard = new KanbanBoard();
    window.kanbanBoard.init();
});
