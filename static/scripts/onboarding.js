document.addEventListener('DOMContentLoaded', () => {
    carregarTarefas();
});

async function carregarTarefas() {
    const container = document.getElementById('tasksContainer');
    
    try {
        // Busca as tarefas da coluna atual do usuário logado na API
        const response = await fetch('/api/minhas_tarefas');
        if (!response.ok) throw new Error('Falha ao conectar com o servidor.');
        
        const tarefas = await response.json();
        
        // Se a coluna em que o card está não tem tarefas ou ele já fez tudo e não foi movido
        if (tarefas.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-circle"></i>
                    <h3>Tudo Certo por Aqui!</h3>
                    <p>Você não tem nenhuma pendência para esta etapa no momento. Aguarde as próximas orientações da equipe.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = ''; // Limpa o loading
        
        // Renderiza cada tarefa recebida do banco de dados
        tarefas.forEach(tarefa => {
            const isConcluida = tarefa.status === 'concluida';
            
            const card = document.createElement('div');
            card.className = `task-card ${isConcluida ? 'completed' : ''}`;
            card.id = `card-${tarefa.id}`;
            
            card.innerHTML = `
                <div class="checkbox-wrapper">
                    <div class="custom-checkbox ${isConcluida ? 'checked' : ''}" 
                         onclick="toggleTarefa(${tarefa.id}, this, document.getElementById('card-${tarefa.id}'))"
                         id="checkbox-${tarefa.id}">
                        <i class="fas fa-check"></i>
                    </div>
                </div>
                <div class="task-text">
                    <h3>${tarefa.titulo}</h3>
                    ${tarefa.descricao ? `<p>${tarefa.descricao}</p>` : ''}
                </div>
            `;
            container.appendChild(card);
        });
        
    } catch (error) {
        container.innerHTML = `
            <div style="text-align: center; color: #FF3B30; padding: 30px; background: white; border-radius: 16px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 15px;"></i>
                <h3>Ops! Algo deu errado.</h3>
                <p style="color: #666;">Não conseguimos carregar suas tarefas. Verifique sua internet e recarregue a página.</p>
                <button onclick="location.reload()" style="margin-top: 15px; padding: 10px 20px; background: #FF3B30; color: white; border: none; border-radius: 8px; cursor: pointer;">Tentar Novamente</button>
            </div>
        `;
        console.error('Erro no Guia de Bolso:', error);
    }
}

// Função para marcar/desmarcar a tarefa
async function toggleTarefa(taskId, checkboxElement, cardElement) {
    // 1. Atualização Otimista da Interface (Muda a tela imediatamente para não parecer lento)
    const isCurrentlyChecked = checkboxElement.classList.contains('checked');
    const newStatus = isCurrentlyChecked ? 'pendente' : 'concluida';
    
    // Desativa o clique temporariamente para evitar double-click
    checkboxElement.style.pointerEvents = 'none';
    
    // Troca as classes de visualização no CSS
    checkboxElement.classList.toggle('checked');
    cardElement.classList.toggle('completed');

    try {
        // 2. Envia a mudança para o Backend
        const response = await fetch(`/api/atualizar_tarefa/${taskId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) {
            throw new Error('Falha ao salvar no banco de dados.');
        }
        
    } catch (error) {
        console.error(error);
        // Se der erro de internet, desfaz a alteração visual
        checkboxElement.classList.toggle('checked');
        cardElement.classList.toggle('completed');
        alert('Erro ao atualizar a tarefa. Verifique sua conexão.');
    } finally {
        // Reativa o clique
        checkboxElement.style.pointerEvents = 'auto';
    }
}