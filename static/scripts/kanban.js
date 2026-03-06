/**
 * kanban.js
 * Gerenciamento do quadro Kanban com integração completa à API
 */

class KanbanBoard {
    constructor() {
        this.columns = {};
        this.draggedCard = null;
        this.colunas = [];
        this.init();
    }

    async init() {
        await this.loadColunas();
        this.setupDragAndDrop();
        await this.loadCollaborators();
        this.setupSearch();
        this.setupFilters();
    }

    async loadColunas() {
        // Carregar colunas da API
        this.colunas = await ApiService.getColunas();
        
        // Mapear colunas para elementos DOM
        this.colunas.forEach(coluna => {
            const elementId = `coluna-${coluna.id}`;
            let columnElement = document.getElementById(elementId);
            
            // Se não existir, criar dinamicamente
            if (!columnElement) {
                columnElement = this.criarColunaDOM(coluna);
            }
            
            this.columns[coluna.id] = columnElement;
        });
    }

    criarColunaDOM(coluna) {
        const container = document.querySelector('.kanban-columns');
        if (!container) return null;
        
        const columnHtml = `
            <div class="kanban-column column-${coluna.setor_nome.toLowerCase()}" id="coluna-${coluna.id}">
                <div class="column-header" style="border-color: ${coluna.setor_cor};">
                    <h3>${coluna.nome}</h3>
                    <span class="column-count">0</span>
                </div>
                <div class="tasks-container" data-coluna-id="${coluna.id}"></div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', columnHtml);
        return container.querySelector(`#coluna-${coluna.id} .tasks-container`);
    }

    async loadCollaborators() {
        try {
            const tasks = await ApiService.getTasks();
            
            // Limpar todas as colunas
            Object.values(this.columns).forEach(col => {
                if (col) col.innerHTML = '';
            });

            // Renderizar cards
            tasks.forEach(task => this.renderCard(task));
            this.updateColumnCounts();
            
        } catch (error) {
            console.error('Erro ao carregar colaboradores:', error);
            showNotification('Erro ao carregar dados do servidor', 'error');
        }
    }

    renderCard(task) {
        const card = document.createElement('div');
        const isUrgent = task.priority === 'high';
        
        card.className = `task-card ${isUrgent ? 'high-priority' : 'medium-priority'}`;
        card.dataset.id = task.id;
        card.dataset.taskData = JSON.stringify(task);
        card.setAttribute('draggable', 'true');

        // Iniciais para avatar
        const initials = task.title.split(' ')
            .map(n => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase() || 'NO';

        card.innerHTML = `
            <div class="task-header">
                <div class="task-tags">
                    <span class="task-tag" style="background: ${isUrgent ? 'rgba(255, 59, 48, 0.1)' : '#E5E5EA'}; color: ${isUrgent ? '#FF3B30' : '#333'};">
                        ${isUrgent ? 'URGENTE' : 'NO PRAZO'}
                    </span>
                    <span class="task-tag" style="background: #E5E5EA; color: #333;">
                        ${task.department.toUpperCase()}
                    </span>
                </div>
                <div class="task-actions">
                    <button class="task-action-btn view-task" title="Ver Detalhes">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="task-action-btn delete-task" title="Arquivar">
                        <i class="fas fa-archive"></i>
                    </button>
                </div>
            </div>
            <h4 class="task-title">${task.title}</h4>
            <p class="task-description">${task.description}</p>
            
            <!-- Barra de Progresso -->
            <div class="task-progress" style="margin: 10px 0;">
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 5px;">
                    <span>Progresso</span>
                    <span>${task.progress || 0}%</span>
                </div>
                <div style="height: 4px; background: #F0F0F0; border-radius: 2px; overflow: hidden;">
                    <div style="height: 100%; width: ${task.progress || 0}%; background: #34C759; border-radius: 2px;"></div>
                </div>
            </div>
            
            <div class="task-footer">
                <div class="task-assignee">
                    <div class="assignee-avatar">${initials}</div>
                    <span class="assignee-name">${task.cargo || 'Em Integração'}</span>
                </div>
                <div class="task-deadline">
                    <i class="far fa-calendar"></i>
                    <span>${task.deadline || 'A definir'}</span>
                </div>
            </div>
        `;

        // Event listeners
        this.attachCardEvents(card, task.id);
        
        // Adicionar à coluna correta
        const targetColumn = this.columns[task.status];
        if (targetColumn) {
            targetColumn.appendChild(card);
        }
    }

    attachCardEvents(card, taskId) {
        // Botão de visualizar detalhes
        card.querySelector('.view-task')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showTaskDetails(taskId);
        });

        // Botão de arquivar
        card.querySelector('.delete-task')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteTask(card, taskId);
        });

        // Drag events
        card.addEventListener('dragstart', (e) => {
            this.draggedCard = card;
            card.classList.add('dragging');
            e.dataTransfer.setData('text/plain', taskId);
            e.dataTransfer.effectAllowed = 'move';
        });

        card.addEventListener('dragend', () => {
            this.draggedCard = null;
            card.classList.remove('dragging');
            card.style.opacity = '1';
        });
    }

    async showTaskDetails(cardId) {
        const detalhes = await ApiService.getCardDetalhes(cardId);
        if (!detalhes) return;
        
        this.renderTaskModal(detalhes);
    }

    renderTaskModal(detalhes) {
        // Verificar se modal já existe
        let modal = document.getElementById('taskDetailModal');
        if (modal) modal.remove();
        
        // Criar modal
        modal = document.createElement('div');
        modal.id = 'taskDetailModal';
        modal.className = 'task-modal-overlay';
        modal.style.display = 'flex';
        
        const card = detalhes.card;
        const tarefas = detalhes.tarefas;
        
        // Agrupar tarefas por setor
        const tarefasPorSetor = {};
        tarefas.forEach(t => {
            if (!tarefasPorSetor[t.setor_nome]) {
                tarefasPorSetor[t.setor_nome] = [];
            }
            tarefasPorSetor[t.setor_nome].push(t);
        });
        
        let tarefasHtml = '';
        for (const [setor, lista] of Object.entries(tarefasPorSetor)) {
            tarefasHtml += `
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #666; margin-bottom: 10px;">${setor}</h4>
                    <div class="task-list">
            `;
            
            lista.forEach(tarefa => {
                tarefasHtml += `
                    <div class="task-item" data-tarefa-id="${tarefa.id}">
                        <div class="task-checkbox ${tarefa.concluida ? 'checked' : ''}" 
                             onclick="window.kanbanBoard.toggleTarefa(${tarefa.id}, ${!tarefa.concluida})">
                            <i class="fas fa-check"></i>
                        </div>
                        <div class="task-text">${tarefa.descricao}</div>
                        <span class="task-status ${tarefa.concluida ? 'completed' : 'pending'}">
                            ${tarefa.concluida ? 'Concluído' : 'Pendente'}
                        </span>
                    </div>
                `;
            });
            
            tarefasHtml += `</div></div>`;
        }
        
        modal.innerHTML = `
            <div class="task-modal" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>${card.colaborador_nome}</h3>
                    <button class="close-modal" onclick="document.getElementById('taskDetailModal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                        <div>
                            <p><strong>Cargo:</strong> ${card.cargo || 'Não informado'}</p>
                            <p><strong>Email:</strong> ${card.email || 'Não informado'}</p>
                        </div>
                        <div>
                            <p><strong>CPF:</strong> ${card.cpf || 'Não informado'}</p>
                            <p><strong>Matrícula:</strong> ${card.matricula || 'Não informado'}</p>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 30px;">
                        <h4 style="margin-bottom: 15px;">Checklist de Tarefas</h4>
                        ${tarefasHtml}
                    </div>
                    
                    <div>
                        <h4 style="margin-bottom: 15px;">Anotações do Colaborador</h4>
                        <textarea id="anotacoesTextarea" class="form-control" rows="4" 
                                  placeholder="Anotações pessoais (serão criptografadas)">${detalhes.anotacoes || ''}</textarea>
                        <button class="btn-action btn-primary-action" 
                                onclick="window.kanbanBoard.salvarAnotacoes('${card.token_acesso}')"
                                style="margin-top: 10px;">
                            Salvar Anotações
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    async toggleTarefa(tarefaId, concluida) {
        const result = await ApiService.toggleTarefa(tarefaId, concluida);
        
        if (result.success) {
            // Atualizar UI
            const checkbox = document.querySelector(`.task-item[data-tarefa-id="${tarefaId}"] .task-checkbox`);
            const status = document.querySelector(`.task-item[data-tarefa-id="${tarefaId}"] .task-status`);
            
            if (checkbox) {
                if (concluida) {
                    checkbox.classList.add('checked');
                    status.textContent = 'Concluído';
                    status.className = 'task-status completed';
                } else {
                    checkbox.classList.remove('checked');
                    status.textContent = 'Pendente';
                    status.className = 'task-status pending';
                }
            }
            
            // Recarregar lista de tasks para atualizar progresso nos cards
            this.loadCollaborators();
        }
    }

    async salvarAnotacoes(token) {
        const anotacao = document.getElementById('anotacoesTextarea').value;
        const result = await ApiService.salvarAnotacao(token, anotacao);
        
        if (result.success) {
            showNotification('Anotações salvas com sucesso!', 'success');
        }
    }

    async createNewTask(form) {
        const formData = new FormData(form);
        
        // Construir objeto de dados
        const tarefasIniciais = [];
        
        // Exemplo de tarefas padrão por setor (você pode personalizar)
        const colunaInicialId = parseInt(formData.get('coluna_inicial_id') || '1');
        
        // Adicionar algumas tarefas padrão baseadas no setor
        if (colunaInicialId === 1) { // RH
            tarefasIniciais.push(
                { descricao: 'Enviar documentos pessoais', coluna_id: 1 },
                { descricao: 'Assinar contrato de trabalho', coluna_id: 1 }
            );
        } else if (colunaInicialId === 3) { // TI
            tarefasIniciais.push(
                { descricao: 'Criar e-mail corporativo', coluna_id: 3 },
                { descricao: 'Configurar notebook', coluna_id: 3 }
            );
        }
        
        const newColaborador = {
            nome: formData.get('nome'),
            cargo: formData.get('cargo'),
            email: formData.get('email'),
            cpf: formData.get('cpf'),
            matricula: formData.get('matricula'),
            data_inicio: formData.get('data_inicio'),
            coluna_inicial_id: colunaInicialId,
            prioridade: formData.get('prioridade') || 'medium',
            observacoes: formData.get('observacoes'),
            tarefas_iniciais: tarefasIniciais,
            criado_por: 'RH'
        };
        
        const result = await ApiService.createTask(newColaborador);
        
        if (result.success) {
            showNotification('Colaborador adicionado com sucesso! Token copiado para área de transferência.', 'success');
            this.loadCollaborators();
            return true;
        } else {
            showNotification('Erro ao adicionar colaborador', 'error');
            return false;
        }
    }

    setupDragAndDrop() {
        Object.keys(this.columns).forEach(colunaId => {
            const column = this.columns[colunaId];
            if (!column) return;

            column.addEventListener('dragover', e => {
                e.preventDefault();
                column.style.backgroundColor = 'rgba(0, 122, 255, 0.05)';
            });

            column.addEventListener('dragleave', () => {
                column.style.backgroundColor = '';
            });

            column.addEventListener('drop', async (e) => {
                e.preventDefault();
                column.style.backgroundColor = '';

                if (!this.draggedCard) return;
                
                const taskId = this.draggedCard.dataset.id;
                const novaColunaId = column.dataset.colunaId;
                
                // Mover visualmente
                if (this.draggedCard.parentNode !== column) {
                    column.appendChild(this.draggedCard);
                    
                    // Atualizar no backend
                    const result = await ApiService.updateTaskStatus(taskId, novaColunaId);
                    
                    if (result.success) {
                        showNotification('Colaborador movido com sucesso!', 'success');
                        this.updateColumnCounts();
                        
                        // Notificar próximo setor (simplificado)
                        const colunaDestino = this.colunas.find(c => c.id == novaColunaId);
                        if (colunaDestino) {
                            showNotification(`Tarefas agora com: ${colunaDestino.setor_nome}`, 'info');
                        }
                    } else {
                        showNotification('Erro ao mover colaborador', 'error');
                        // Reverter movimento
                        this.loadCollaborators();
                    }
                }
            });
        });
    }

    async deleteTask(cardElement, taskId) {
        if (confirm('Tem certeza que deseja arquivar este colaborador do fluxo?')) {
            const result = await ApiService.deleteTask(taskId);
            
            if (result.success) {
                cardElement.remove();
                this.updateColumnCounts();
                showNotification('Colaborador arquivado com sucesso!', 'success');
            } else {
                showNotification('Erro ao arquivar colaborador', 'error');
            }
        }
    }

    updateColumnCounts() {
        Object.keys(this.columns).forEach(colunaId => {
            const column = this.columns[colunaId];
            if (!column) return;
            
            const count = column.querySelectorAll('.task-card').length;
            const header = column.closest('.kanban-column')?.querySelector('.column-count');
            if (header) header.textContent = count;
        });
    }

    setupSearch() {
        const searchInput = document.getElementById('searchInput');
        if (!searchInput) return;
        
        searchInput.addEventListener('input', () => {
            const term = searchInput.value.toLowerCase();
            
            document.querySelectorAll('.task-card').forEach(card => {
                const title = card.querySelector('.task-title')?.textContent.toLowerCase() || '';
                const description = card.querySelector('.task-description')?.textContent.toLowerCase() || '';
                const matches = title.includes(term) || description.includes(term);
                
                card.style.display = matches ? 'block' : 'none';
            });
        });
    }

    setupFilters() {
        // Filtros por setor
        document.querySelectorAll('.department-filter').forEach(filter => {
            filter.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Atualizar UI dos filtros
                document.querySelectorAll('.department-filter').forEach(f => 
                    f.classList.remove('active'));
                filter.classList.add('active');
                
                const dept = filter.dataset.department;
                this.filterByDepartment(dept);
            });
        });
    }

    filterByDepartment(department) {
        if (department === 'todos') {
            document.querySelectorAll('.task-card').forEach(card => 
                card.style.display = 'block');
            return;
        }
        
        document.querySelectorAll('.task-card').forEach(card => {
            const tags = card.querySelector('.task-tags')?.textContent.toLowerCase() || '';
            const matches = tags.includes(department.toLowerCase());
            card.style.display = matches ? 'block' : 'none';
        });
    }

    validateTaskForm(form) {
        const nome = form.querySelector('#taskTitle')?.value;
        const cargo = form.querySelector('#taskCargo')?.value;
        return nome && nome.trim() !== '' && cargo && cargo.trim() !== '';
    }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.kanbanBoard = new KanbanBoard();
});