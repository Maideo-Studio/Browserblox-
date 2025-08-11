// User management system
class UserManager {
    constructor() {
        this.currentUser = null;
        try {
            this.users = JSON.parse(localStorage.getItem('rogold_users')) || {};
        } catch (e) {
            console.error("Error parsing rogold_users from localStorage, resetting:", e);
            this.users = {};
            // Optionally clear corrupt data to prevent repeated errors
            localStorage.removeItem('rogold_users'); 
        }
    }

    register(username, password) {
        if (this.users[username]) {
            return { success: false, message: 'Usuário já existe!' };
        }
        this.users[username] = { password, createdAt: new Date().toISOString() };
        localStorage.setItem('rogold_users', JSON.stringify(this.users));
        return { success: true };
    }

    login(username, password) {
        const user = this.users[username];
        if (!user || user.password !== password) {
            return { success: false, message: 'Usuário ou senha incorretos!' };
        }
        this.currentUser = username;
        localStorage.setItem('rogold_currentUser', username);
        return { success: true };
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('rogold_currentUser');
    }

    getCurrentUser() {
        return localStorage.getItem('rogold_currentUser');
    }

    updateUser(currentUsername, currentPassword, newUsername, newPassword) {
        const user = this.users[currentUsername];
        if (!user || user.password !== currentPassword) {
            return { success: false, message: 'Senha atual incorreta!' };
        }

        // Se está mudando o username
        if (newUsername && newUsername !== currentUsername) {
            if (this.users[newUsername]) {
                return { success: false, message: 'Novo usuário já existe!' };
            }
            // Copy data to new username. Profile data handled by ProfileManager.
            this.users[newUsername] = { ...this.users[currentUsername] };
            delete this.users[currentUsername];
            
            // Update session
            localStorage.setItem('rogold_currentUser', newUsername);
            this.currentUser = newUsername;
        }

        // Se está mudando a senha
        if (newPassword) {
            const targetUsername = newUsername || currentUsername;
            this.users[targetUsername].password = newPassword;
        }

        localStorage.setItem('rogold_users', JSON.stringify(this.users));
        return { success: true, newUsername: newUsername || currentUsername };
    }

    getAllUsernames() {
        return Object.keys(this.users);
    }
}

const userManager = new UserManager();

// Profile functionality
class ProfileManager {
    constructor(userManager) {
        this.userManager = userManager;
        try {
            this.profiles = JSON.parse(localStorage.getItem('rogold_profiles')) || {};
        } catch (e) {
            console.error("Error parsing rogold_profiles from localStorage, resetting:", e);
            this.profiles = {};
            // Optionally clear corrupt data to prevent repeated errors
            localStorage.removeItem('rogold_profiles');
        }
    }

    getProfile(username) {
        let rawProfile = this.profiles[username];

        const defaultProfile = {
            bio: 'Este usuário ainda não escreveu uma descrição.',
            status: 'Offline',
            friends: [],
            sentRequests: [],
            receivedRequests: [],
            favorites: [],
            profilePicture: null
        };

        // Merge existing profile data with default values to ensure all fields are present.
        const mergedProfile = { ...defaultProfile, ...rawProfile };

        // Ensure array types for lists and filter out non-string/empty values
        ['friends', 'sentRequests', 'receivedRequests', 'favorites'].forEach(key => {
            if (!Array.isArray(mergedProfile[key])) {
                mergedProfile[key] = [];
            }
            mergedProfile[key] = mergedProfile[key].filter(item => typeof item === 'string' && item.trim() !== '');
        });

        // Specifically handle `joinDate` as it might be sourced from `userManager.users`
        if (!mergedProfile.joinDate) {
            mergedProfile.joinDate = this.userManager.users[username]?.createdAt || new Date().toISOString();
        }

        // Update the stored profile with the merged structure.
        this.profiles[username] = mergedProfile;
        this.saveProfiles();
        
        return mergedProfile;
    }

    updateProfile(username, updates) {
        if (this.profiles[username]) {
            Object.assign(this.profiles[username], updates);
            this.saveProfiles();
            return true;
        }
        return false;
    }

    // Send a friend request
    sendFriendRequest(senderUsername, receiverUsername) {
        if (senderUsername === receiverUsername) {
            return { success: false, message: 'Você não pode enviar um pedido de amizade para si mesmo!' };
        }
        if (!this.userManager.users[receiverUsername]) {
            return { success: false, message: 'Usuário não encontrado.' };
        }

        const senderProfile = this.getProfile(senderUsername);
        const receiverProfile = this.getProfile(receiverUsername);

        if (senderProfile.friends.includes(receiverUsername)) {
            return { success: false, message: 'Vocês já são amigos!' };
        }
        if (senderProfile.sentRequests.includes(receiverUsername)) {
            return { success: false, message: 'Você já enviou um pedido de amizade para este usuário!' };
        }
        if (senderProfile.receivedRequests.includes(receiverUsername)) {
            return { success: false, message: 'Este usuário já enviou um pedido de amizade para você! Aceite-o.' };
        }

        senderProfile.sentRequests.push(receiverUsername);
        receiverProfile.receivedRequests.push(senderUsername);
        this.saveProfiles();
        return { success: true, message: `Pedido de amizade enviado para ${receiverUsername}!` };
    }

    // Accept a friend request
    acceptFriendRequest(accepterUsername, senderUsername) {
        const accepterProfile = this.getProfile(accepterUsername);
        const senderProfile = this.getProfile(senderUsername);

        // Remove from received requests
        accepterProfile.receivedRequests = accepterProfile.receivedRequests.filter(user => user !== senderUsername);
        // Add to friends list for accepter
        accepterProfile.friends.push(senderUsername);

        // Remove from sent requests for sender
        senderProfile.sentRequests = senderProfile.sentRequests.filter(user => user !== accepterUsername);
        // Add to friends list for sender
        senderProfile.friends.push(accepterUsername);
        
        this.saveProfiles();
        return { success: true, message: `Você e ${senderUsername} agora são amigos!` };
    }

    // Decline a friend request
    declineFriendRequest(declinerUsername, senderUsername) {
        const declinerProfile = this.getProfile(declinerUsername);
        const senderProfile = this.getProfile(senderUsername);

        // Remove from received requests for decliner
        declinerProfile.receivedRequests = declinerProfile.receivedRequests.filter(user => user !== senderUsername);
        // Remove from sent requests for sender
        senderProfile.sentRequests = senderProfile.sentRequests.filter(user => user !== declinerUsername);

        this.saveProfiles();
        return { success: true, message: `Pedido de amizade de ${senderUsername} recusado.` };
    }

    // Check if two users are friends
    areFriends(user1, user2) {
        const profile1 = this.getProfile(user1);
        return profile1.friends.includes(user2);
    }

    // Check if a request has been sent
    hasSentRequest(sender, receiver) {
        const senderProfile = this.getProfile(sender);
        return senderProfile.sentRequests.includes(receiver);
    }

    // Check if a request has been received
    hasReceivedRequest(receiver, sender) {
        const receiverProfile = this.getProfile(receiver);
        return receiverProfile.receivedRequests.includes(sender);
    }

    // Add a game to favorites
    addFavorite(username, gameTitle) {
        const profile = this.getProfile(username);
        // Ensure gameTitle is a valid string before adding
        if (typeof gameTitle !== 'string' || gameTitle.trim() === '') {
            return { success: false, message: 'Nome de jogo inválido.' };
        }
        if (!profile.favorites.includes(gameTitle)) {
            profile.favorites.push(gameTitle);
            this.saveProfiles();
            return { success: true, message: `'${gameTitle}' adicionado aos seus favoritos!` };
        }
        return { success: false, message: `'${gameTitle}' já está nos seus favoritos.` };
    }

    // Remove a game from favorites
    removeFavorite(username, gameTitle) {
        const profile = this.getProfile(username);
        const initialLength = profile.favorites.length;
        // Ensure gameTitle is a valid string for comparison
        if (typeof gameTitle !== 'string' || gameTitle.trim() === '') {
            return { success: false, message: 'Nome de jogo inválido para remover.' };
        }
        profile.favorites = profile.favorites.filter(game => game !== gameTitle);
        if (profile.favorites.length < initialLength) {
            this.saveProfiles();
            return { success: true, message: `'${gameTitle}' removido dos seus favoritos.` };
        }
        return { success: false, message: `'${gameTitle}' não está nos seus favoritos.` };
    }

    saveProfiles() {
        localStorage.setItem('rogold_profiles', JSON.stringify(this.profiles));
    }
}

const profileManager = new ProfileManager(userManager);

// Community Management
class CommunityManager {
    constructor() {
        try {
            this.blogs = JSON.parse(localStorage.getItem('rogold_blogs')) || [];
        } catch (e) {
            console.error("Error parsing rogold_blogs from localStorage, resetting:", e);
            this.blogs = [];
            // Optionally clear corrupt data to prevent repeated errors
            localStorage.removeItem('rogold_blogs');
        }
        this.currentBlog = null;
    }

    createBlog(title, message, author) {
        const blog = {
            id: Date.now(),
            title,
            message,
            author,
            createdAt: new Date().toISOString(),
            messages: []
        };
        
        this.blogs.unshift(blog);
        this.saveBlogs();
        return blog;
    }

    getBlogs() {
        return this.blogs;
    }

    getBlog(id) {
        return this.blogs.find(blog => blog.id === id);
    }

    addMessage(blogId, message, author) {
        const blog = this.getBlog(blogId);
        if (blog) {
            const newMessage = {
                id: Date.now(),
                message,
                author,
                timestamp: new Date().toISOString()
            };
            blog.messages.push(newMessage);
            this.saveBlogs();
            return newMessage;
        }
        return null;
    }

    saveBlogs() {
        localStorage.setItem('rogold_blogs', JSON.stringify(this.blogs));
    }
}

const communityManager = new CommunityManager();

// Helper functions for showing/hiding sections with fade animation
function showSection(sectionElement) {
    if (!sectionElement) return;
    sectionElement.style.opacity = '0'; // Ensure starting opacity is 0 for fade-in
    sectionElement.classList.remove('hidden'); // This makes display: block via CSS
    // Force reflow for transition to apply correctly
    sectionElement.offsetHeight; 
    sectionElement.style.opacity = '1'; // Trigger CSS transition
}

function hideSection(sectionElement) {
    if (!sectionElement) return;
    sectionElement.style.opacity = '0'; // Trigger CSS transition for fade-out
    // After transition, set display to none
    setTimeout(() => {
        sectionElement.classList.add('hidden');
    }, 300); // Match transition duration (0.3s)
}

// Function to manage which auth/form section is visible
// This function hides all auth forms except the target one.
function showOnlyAuthSection(targetId) {
    // This list should only contain forms or detail views that replace other content.
    const authSections = ['login-section', 'register-section', 'settings-section', 'profile-edit-section', 'create-blog-form', 'blog-detail'];
    
    authSections.forEach(id => {
        const section = document.getElementById(id);
        if (section) {
            if (id === targetId) {
                showSection(section);
            } else {
                hideSection(section);
            }
        }
    });
}

// Global UI functions for inline HTML event handlers (e.g., onclick) and event listeners
// Defined as function declarations so they are hoisted and available throughout the script.
function openLoginModal() {
    // Hide all main content sections and display only the target auth section
    hideSection(document.getElementById('featured-games'));
    hideSection(document.querySelector('.banner'));
    hideSection(document.getElementById('profile-section'));
    hideSection(document.getElementById('community-section'));
    hideSection(document.getElementById('blog-list')); 

    showOnlyAuthSection('login-section');
    setActiveNavLink(null); // No nav link active when forms are open
}

function openRegisterModal() {
    // Hide all main content sections and display only the target auth section
    hideSection(document.getElementById('featured-games'));
    hideSection(document.querySelector('.banner'));
    hideSection(document.getElementById('profile-section'));
    hideSection(document.getElementById('community-section'));
    hideSection(document.getElementById('blog-list')); 

    showOnlyAuthSection('register-section');
    setActiveNavLink(null); // No nav link active when forms are open
}

function openSettingsModal() {
    const currentUser = userManager.getCurrentUser();
    if (currentUser) {
        document.getElementById('current-username-inline').value = currentUser;
        
        // Hide all main content sections and display only the target auth section
        hideSection(document.getElementById('featured-games'));
        hideSection(document.querySelector('.banner'));
        hideSection(document.getElementById('profile-section'));
        hideSection(document.getElementById('community-section'));
        hideSection(document.getElementById('blog-list')); 
        
        showOnlyAuthSection('settings-section');
        setActiveNavLink(null); // No nav link active when forms are open
    } else {
        alert('Você precisa estar logado para acessar as configurações.');
        openLoginModal(); // Redirect to login if not logged in
    }
}

// Function to handle user logout
async function logoutUser() {
    const confirmLogout = await confirm('Tem certeza que deseja sair da sua conta?');
    if (confirmLogout) {
        userManager.logout();
        alert('Você saiu da sua conta.');
        
        // Ensure all active content sections and auth forms are hidden
        hideSection(document.getElementById('profile-section'));
        hideSection(document.getElementById('community-section'));
        hideSection(document.getElementById('blog-list')); 
        showOnlyAuthSection(''); // Hide all auth forms (login, register, settings, profile-edit, blog forms)

        // After a short delay for transitions to complete, show main content and then login
        setTimeout(() => {
            showMainContent(); // Go back to main content
            updateProfileLink(); // Update nav link to "Perfil" / "Login"
            openLoginModal(); // Directly open the login form after logout
        }, 300); 
    }
}

// This function is for closing an auth form and returning to the main page content.
function hideCurrentAuthFormAndShowMainContent() {
    // Hide all auth forms first
    showOnlyAuthSection(''); // This will hide all forms and ensures nothing is left hanging

    // Then show the default main page content
    showMainContent();
}

// NEW: Function to show the main content (banner and featured games)
function showMainContent() {
    hideSection(document.getElementById('profile-section'));
    hideSection(document.getElementById('community-section'));
    hideSection(document.getElementById('blog-list'));
    showOnlyAuthSection(''); // Corrected: This function handles hiding all auth sections

    showSection(document.getElementById('featured-games'));
    showSection(document.querySelector('.banner'));
    
    updateFeaturedGameCards(); // Update game cards when returning to main content
    setActiveNavLink('home-link'); // Set 'Home' as active in nav
}

// Enhanced UI Functions
function showProfile(username) {
    const profileSection = document.getElementById('profile-section');
    
    // Update profile data
    const profile = profileManager.getProfile(username);
    document.getElementById('profile-username').textContent = username;
    document.getElementById('profile-bio').textContent = profile.bio;
    document.querySelector('.profile-status').textContent = `Status: ${profile.status}`;
    document.getElementById('join-date').textContent = new Date(profile.joinDate).toLocaleDateString('pt-BR');
    document.getElementById('favorite-count').textContent = profile.favorites.length; // NEW: Update favorite count

    // Update profile picture
    const profileAvatarImg = document.getElementById('profile-avatar-img');
    const avatarPlaceholder = document.getElementById('avatar-placeholder');

    if (profile.profilePicture) {
        profileAvatarImg.src = profile.profilePicture;
        profileAvatarImg.classList.remove('hidden');
        avatarPlaceholder.classList.add('hidden');
    } else {
        profileAvatarImg.classList.add('hidden');
        avatarPlaceholder.classList.remove('hidden');
    }
    
    // Hide other sections, show profile
    hideSection(document.getElementById('featured-games'));
    hideSection(document.querySelector('.banner'));
    hideSection(document.getElementById('community-section')); 
    hideSection(document.getElementById('blog-list')); 
    showOnlyAuthSection(''); // Hide login/register forms if they were open
    
    showSection(profileSection); // Use showSection
    setActiveNavLink('profile-link'); // Set 'Perfil' as active in nav
    
    // Setup tab functionality
    updateProfileTabs();
}

function hideProfile() {
    const profileSection = document.getElementById('profile-section');
    
    hideSection(profileSection); 
    
    setTimeout(() => {
        showMainContent(); // Go back to main content
        showOnlyAuthSection(''); // Ensure any profile sub-forms are hidden when returning to main content
    }, 300);
}

// New functions for community section
function showCommunity() {
    const communitySection = document.getElementById('community-section');
    const blogList = document.getElementById('blog-list'); 

    // Hide main content and profile section
    hideSection(document.getElementById('featured-games'));
    hideSection(document.querySelector('.banner'));
    hideSection(document.getElementById('profile-section'));
    showOnlyAuthSection(''); // Hide any active auth forms (login, register, etc.)

    // Show community section and load blogs
    showSection(communitySection);
    showSection(blogList); 
    loadBlogs();
    setActiveNavLink('community-link'); // Set 'Comunidade' as active in nav
}

function hideCommunity() {
    const communitySection = document.getElementById('community-section');
    const blogList = document.getElementById('blog-list'); 
    hideSection(communitySection); 
    hideSection(blogList); 

    setTimeout(() => {
        showMainContent(); // Go back to main content
        showOnlyAuthSection(''); // Ensure any community sub-forms are hidden when returning to main content
    }, 300);
}

// Tab switching functionality
function updateProfileTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach(button => {
        button.onclick = null; // Remove previous listeners to prevent multiple calls
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;

            // Remove active classes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));

            // Add active class to clicked button and corresponding panel
            button.classList.add('active');
            const targetPanel = document.getElementById(`${targetTab}-tab`);
            if (targetPanel) targetPanel.classList.add('active');

            // Special handling for 'friends' tab
            if (targetTab === 'friends') {
                renderFriendLists();
            } else if (targetTab === 'favorites') { // NEW: Handle favorites tab
                renderFavoriteGamesList();
            }
        });
    });
    // Ensure the initially active tab is rendered
    const activeTabButton = document.querySelector('.profile-tabs .tab-button.active');
    if (activeTabButton) {
        const targetTab = activeTabButton.dataset.tab;
        if (targetTab === 'friends') {
            renderFriendLists();
        } else if (targetTab === 'favorites') {
            renderFavoriteGamesList();
        }
    }
}

function editProfile() {
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) return;
    
    const profile = profileManager.getProfile(currentUser);
    document.getElementById('bio-input-inline').value = profile.bio;
    document.getElementById('status-input-inline').value = profile.status;
    
    showOnlyAuthSection('profile-edit-section'); 
    setActiveNavLink(null); // No nav link active when forms are open
}

function closeProfileEdit() {
    // This will hide the edit form and then re-show the profile section
    showOnlyAuthSection(''); 
    showSection(document.getElementById('profile-section'));
    setActiveNavLink('profile-link'); // Keep 'Perfil' active
}

// Replace native dialogs
function customAlert(message, title = 'Alerta') {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'browser-dialog-overlay';
        overlay.innerHTML = `
            <div class="browser-dialog">
                <div class="browser-dialog-title">${escapeHtml(title)}</div>
                <div class="browser-dialog-message">${escapeHtml(message)}</div>
                <div class="browser-dialog-buttons">
                    <button class="browser-dialog-button">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        overlay.querySelector('button').addEventListener('click', () => {
            overlay.remove();
            resolve();
        });
    });
};

function customConfirm(message, title = 'Confirmação') {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'browser-dialog-overlay';
        overlay.innerHTML = `
            <div class="browser-dialog">
                <div class="browser-dialog-title">${escapeHtml(title)}</div>
                <div class="browser-dialog-message">${escapeHtml(message)}</div>
                <div class="browser-dialog-buttons">
                    <button class="browser-dialog-button" data-value="true">Sim</button>
                    <button class="browser-dialog-button cancel" data-value="false">Não</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        overlay.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', (e) => {
                const result = e.target.dataset.value === 'true';
                overlay.remove();
                resolve(result);
            });
        });
    });
};

function customPrompt(message, defaultValue = '', title = 'Pergunta') {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'browser-dialog-overlay';
        overlay.innerHTML = `
            <div class="browser-dialog">
                <div class="browser-dialog-title">${escapeHtml(title)}</div>
                <div class="browser-dialog-message">${escapeHtml(message)}</div>
                <input type="text" class="browser-dialog-input" value="${escapeHtml(defaultValue)}" placeholder="Digite aqui...">
                <div class="browser-dialog-buttons">
                    <button class="browser-dialog-button" data-value="ok">OK</button>
                    <button class="browser-dialog-button cancel" data-value="cancel">Cancelar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        const input = overlay.querySelector('.browser-dialog-input');
        input.focus();
        input.select();
        
        overlay.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', (e) => {
                const result = e.target.dataset.value === 'ok' ? input.value : null;
                overlay.remove();
                resolve(result);
            });
        });
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                overlay.querySelector('[data-value="ok"]').click();
            }
        });
    });
};

// Replace native dialogs
window.alert = customAlert;
window.confirm = customConfirm;
window.prompt = customPrompt;

// Fix navigation
function updateProfileLink() {
    const profileLink = document.getElementById('profile-link');
    const currentUser = userManager.getCurrentUser();
    
    if (profileLink) { // Ensure profileLink exists on the page
        if (currentUser) {
            profileLink.textContent = currentUser;
            profileLink.onclick = function(e) {
                e.preventDefault();
                showProfile(currentUser);
            };
        } else {
            profileLink.textContent = 'Perfil';
            profileLink.onclick = function(e) {
                e.preventDefault();
                openLoginModal();
            };
        }
    }
}

// NEW: Function to manage active navigation link
function setActiveNavLink(activeLinkId) {
    document.querySelectorAll('.menu a').forEach(link => {
        link.classList.remove('active');
    });
    if (activeLinkId) {
        const activeLink = document.getElementById(activeLinkId);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }
}

// Friend Request Functionality
function renderFriendLists() {
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) {
        document.getElementById('friends-list').innerHTML = '<p class="empty-message">Faça login para ver e gerenciar seus amigos.</p>';
        document.getElementById('incoming-requests').innerHTML = '';
        document.getElementById('outgoing-requests').innerHTML = '';
        document.getElementById('user-search-results').innerHTML = '<p class="empty-message">Procure por usuários para adicionar como amigo.</p>';
        return;
    }

    const profile = profileManager.getProfile(currentUser);

    // Render current friends
    const friendsListContainer = document.getElementById('friends-list');
    if (profile.friends.length === 0) {
        friendsListContainer.innerHTML = '<p class="empty-message">Nenhum amigo ainda.</p>';
    } else {
        friendsListContainer.innerHTML = profile.friends.map(friend => {
            const friendProfile = profileManager.getProfile(friend);
            const safeFriend = typeof friend === 'string' ? friend : 'Desconhecido';
            const friendAvatarHtml = friendProfile.profilePicture 
                ? `<img src="${escapeHtml(friendProfile.profilePicture)}" alt="${escapeHtml(safeFriend)} Avatar">`
                : `${escapeHtml(safeFriend.charAt(0).toUpperCase())}`;
            return `
                <div class="friend-card">
                    <div class="friend-avatar">${friendAvatarHtml}</div>
                    <span class="friend-name">${escapeHtml(safeFriend)}</span>
                </div>
            `;
        }).join('');
    }

    // Render incoming requests
    const incomingRequestsContainer = document.getElementById('incoming-requests');
    if (profile.receivedRequests.length === 0) {
        incomingRequestsContainer.innerHTML = '<p class="empty-message">Nenhum pedido de amizade recebido.</p>';
    } else {
        incomingRequestsContainer.innerHTML = profile.receivedRequests.map(sender => {
            const senderProfile = profileManager.getProfile(sender);
            const safeSender = typeof sender === 'string' ? sender : 'Desconhecido';
            const senderAvatarHtml = senderProfile.profilePicture 
                ? `<img src="${escapeHtml(senderProfile.profilePicture)}" alt="${escapeHtml(safeSender)} Avatar">`
                : `${escapeHtml(safeSender.charAt(0).toUpperCase())}`;
            return `
                <div class="request-card">
                    <div class="friend-avatar">${senderAvatarHtml}</div>
                    <span class="username">${escapeHtml(safeSender)}</span>
                    <div class="actions">
                        <button class="primary-button" onclick="acceptFriendRequest('${escapeHtml(sender)}')">Aceitar</button>
                        <button class="danger-button" onclick="declineFriendRequest('${escapeHtml(sender)}')">Recusar</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Render outgoing requests
    const outgoingRequestsContainer = document.getElementById('outgoing-requests');
    if (profile.sentRequests.length === 0) {
        outgoingRequestsContainer.innerHTML = '<p class="empty-message">Nenhum pedido de amizade enviado.</p>';
    } else {
        outgoingRequestsContainer.innerHTML = profile.sentRequests.map(receiver => {
            const receiverProfile = profileManager.getProfile(receiver);
            const safeReceiver = typeof receiver === 'string' ? receiver : 'Desconhecido';
            const receiverAvatarHtml = receiverProfile.profilePicture 
                ? `<img src="${escapeHtml(receiverProfile.profilePicture)}" alt="${escapeHtml(safeReceiver)} Avatar">`
                : `${escapeHtml(safeReceiver.charAt(0).toUpperCase())}`;
            return `
                <div class="request-card">
                    <div class="friend-avatar">${receiverAvatarHtml}</div>
                    <span class="username">${escapeHtml(safeReceiver)}</span>
                    <div class="actions">
                        <button class="secondary-button" disabled>Pendente</button>
                    </div>
                </div>
            `;
        }).join('');
    }
}

async function searchUsers() {
    const searchInput = document.getElementById('user-search-input').value.toLowerCase();
    const searchResultsContainer = document.getElementById('user-search-results');
    const currentUser = userManager.getCurrentUser();

    if (!currentUser) {
        searchResultsContainer.innerHTML = '<p class="empty-message">Faça login para procurar usuários.</p>';
        return;
    }

    if (!searchInput) {
        searchResultsContainer.innerHTML = '<p class="empty-message">Digite um nome de usuário para procurar.</p>';
        return;
    }

    const allUsernames = userManager.getAllUsernames();
    const matchingUsers = allUsernames.filter(username => 
        username.toLowerCase().includes(searchInput) && username !== currentUser
    );

    if (matchingUsers.length === 0) {
        searchResultsContainer.innerHTML = `<p class="empty-message">Nenhum usuário encontrado com "${escapeHtml(searchInput)}".</p>`;
        return;
    }

    const currentUserProfile = profileManager.getProfile(currentUser);

    searchResultsContainer.innerHTML = matchingUsers.map(user => {
        const userProfile = profileManager.getProfile(user);
        const safeUser = typeof user === 'string' ? user : 'Desconhecido';
        const userAvatarHtml = userProfile.profilePicture 
            ? `<img src="${escapeHtml(userProfile.profilePicture)}" alt="${escapeHtml(safeUser)} Avatar">`
            : `${escapeHtml(safeUser.charAt(0).toUpperCase())}`;

        let buttonHtml;
        if (currentUserProfile.friends.includes(safeUser)) {
            buttonHtml = '<button class="secondary-button" disabled>Amigo</button>';
        } else if (currentUserProfile.sentRequests.includes(safeUser)) {
            buttonHtml = '<button class="secondary-button" disabled>Pedido Enviado</button>';
        } else if (currentUserProfile.receivedRequests.includes(safeUser)) {
            buttonHtml = `<button class="primary-button" onclick="acceptFriendRequest('${escapeHtml(safeUser)}')">Aceitar Pedido</button>`;
        } else {
            buttonHtml = `<button class="primary-button" onclick="sendFriendRequest('${escapeHtml(safeUser)}')">Adicionar Amigo</button>`;
        }
        return `
            <div class="user-card">
                <div class="friend-avatar">${userAvatarHtml}</div>
                <span class="username">${escapeHtml(safeUser)}</span>
                <div class="actions">
                    ${buttonHtml}
                </div>
            </div>
        `;
    }).join('');
}

async function sendFriendRequest(receiverUsername) {
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) {
        alert('Você precisa estar logado para enviar pedidos de amizade.');
        return;
    }

    const result = profileManager.sendFriendRequest(currentUser, receiverUsername);
    alert(result.message);
    if (result.success) {
        renderFriendLists(); // Re-render lists to update status
        searchUsers(); // Re-render search results to update button status
    }
}

async function acceptFriendRequest(senderUsername) {
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) {
        alert('Você precisa estar logado para aceitar pedidos de amizade.');
        return;
    }

    const result = await confirm(`Tem certeza que deseja aceitar o pedido de amizade de ${escapeHtml(senderUsername)}?`);
    if (result) {
        const acceptResult = profileManager.acceptFriendRequest(currentUser, senderUsername);
        alert(acceptResult.message);
        if (acceptResult.success) {
            renderFriendLists();
            searchUsers(); // Update search results if still open
        }
    }
}

async function declineFriendRequest(senderUsername) {
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) {
        alert('Você precisa estar logado para recusar pedidos de amizade.');
        return;
    }

    const result = await confirm(`Tem certeza que deseja recusar o pedido de amizade de ${escapeHtml(senderUsername)}?`);
    if (result) {
        const declineResult = profileManager.declineFriendRequest(currentUser, senderUsername);
        alert(declineResult.message);
        if (declineResult.success) {
            renderFriendLists();
            searchUsers(); // Update search results if still open
        }
    }
}

// NEW: Function to render favorited games in the profile tab
function renderFavoriteGamesList() {
    const currentUser = userManager.getCurrentUser();
    const favoritesListContainer = document.getElementById('favorite-games-list');

    if (!currentUser) {
        favoritesListContainer.innerHTML = '<p class="empty-message">Faça login para ver seus jogos favoritos.</p>';
        return;
    }

    const profile = profileManager.getProfile(currentUser);
    const favorites = profile.favorites;

    if (favorites.length === 0) {
        favoritesListContainer.innerHTML = '<p class="empty-message">Nenhum jogo favorito ainda.</p>';
    } else {
        favoritesListContainer.innerHTML = favorites.map(gameTitle => {
            const safeGameTitle = typeof gameTitle === 'string' ? gameTitle : ''; 
            // Map game titles to the correct thumbnail file paths
            let imageSrc = '';
            if (safeGameTitle === 'Natural Disaster Survival') {
                imageSrc = 'thumbnail1.jpg';
            } else if (safeGameTitle === 'Work at a Pizza Place') {
                imageSrc = 'thumbnail2.jpg';
            } else {
                imageSrc = 'default_game_thumbnail.png'; // Fallback for unknown games
            }

            return `
                <div class="game-card game-card-favorite">
                    <div class="game-thumbnail">
                        <img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(safeGameTitle)} Thumbnail">
                    </div>
                    <h4>${escapeHtml(safeGameTitle)}</h4>
                    <button class="play-button" data-game-title="${escapeHtml(safeGameTitle)}">Jogar</button>
                    <button class="favorite-toggle-button remove-favorite-button" data-game-title="${escapeHtml(safeGameTitle)}">Remover</button>
                </div>
            `;
        }).join('');
        // Re-attach event listeners for "remove" buttons in this list
        attachFavoriteToggleListeners(); 
        attachPlayButtonListeners(); // Attach play button listeners for favorite games list
    }
}

// NEW: Function to update favorite buttons on featured game cards
function updateFeaturedGameCards() {
    const currentUser = userManager.getCurrentUser();
    const gameCards = document.querySelectorAll('#featured-games .game-card');

    gameCards.forEach(card => {
        const gameTitle = card.dataset.gameTitle;
        const favoriteButton = card.querySelector('.favorite-toggle-button');
        const gameThumbnail = card.querySelector('.game-thumbnail');
        const playButton = card.querySelector('.play-button'); // Get play button

        // Ensure gameTitle is a string before operations, default to empty string if not
        const safeGameTitle = typeof gameTitle === 'string' ? gameTitle : '';

        // Dynamically set game thumbnail based on safeGameTitle
        let imageSrc = '';
        if (safeGameTitle === 'Natural Disaster Survival') {
            imageSrc = 'thumbnail1.jpg';
        } else if (safeGameTitle === 'Work at a Pizza Place') {
            imageSrc = 'thumbnail2.jpg';
        } else {
            imageSrc = 'default_game_thumbnail.png'; // Fallback for unknown games
        }
        
        if (gameThumbnail) {
            gameThumbnail.innerHTML = `<img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(safeGameTitle)} Thumbnail">`;
        }

        // Update favorite button state
        if (favoriteButton) {
            if (currentUser) {
                const profile = profileManager.getProfile(currentUser);
                // Use safeGameTitle for includes check
                if (profile.favorites.includes(safeGameTitle)) { 
                    favoriteButton.textContent = 'Remover Favorito';
                    favoriteButton.classList.add('remove-favorite-button');
                    favoriteButton.classList.remove('add-favorite-button');
                } else {
                    favoriteButton.textContent = 'Favoritar';
                    favoriteButton.classList.add('add-favorite-button');
                    favoriteButton.classList.remove('remove-favorite-button');
                }
                favoriteButton.disabled = false;
            } else {
                favoriteButton.textContent = 'Favoritar';
                favoriteButton.classList.add('add-favorite-button');
                favoriteButton.classList.remove('remove-favorite-button');
                favoriteButton.disabled = true; // Disable if not logged in
            }
        }

        // Update play button state (it's always enabled now, login check is inside handler)
        if (playButton) {
            // Set data-game-title attribute on play button for easier access
            playButton.setAttribute('data-game-title', safeGameTitle);
        }
    });
    attachFavoriteToggleListeners(); // Re-attach listeners after updating buttons
    attachPlayButtonListeners(); // Attach play button listeners for featured games
}

// NEW: Centralized function to attach favorite toggle listeners
function attachFavoriteToggleListeners() {
    document.querySelectorAll('.favorite-toggle-button').forEach(button => {
        // Remove existing listener to prevent duplicates
        button.onclick = null; 
        button.addEventListener('click', async function(e) {
            const currentUser = userManager.getCurrentUser();
            if (!currentUser) {
                alert('Você precisa estar logado para favoritar jogos.');
                return;
            }

            // Get the parent .game-card element to retrieve the game title
            const gameCard = e.target.closest('.game-card');
            if (!gameCard) {
                console.error("Could not find parent .game-card for favorite button.");
                alert("Erro ao identificar o jogo. Tente novamente.");
                return;
            }
            const gameTitle = gameCard.dataset.gameTitle; 
            
            // Ensure gameTitle is a string, default to empty string if not
            const safeGameTitle = typeof gameTitle === 'string' ? gameTitle : '';

            const profile = profileManager.getProfile(currentUser);
            let result;

            // Use safeGameTitle for favorite operations
            if (profile.favorites.includes(safeGameTitle)) {
                result = profileManager.removeFavorite(currentUser, safeGameTitle);
            } else {
                result = profileManager.addFavorite(currentUser, safeGameTitle);
            }
            alert(result.message);
            if (result.success) {
                // Update favorite count on profile header if profile is visible
                const favoriteCountElement = document.getElementById('favorite-count');
                if (favoriteCountElement) {
                    favoriteCountElement.textContent = profileManager.getProfile(currentUser).favorites.length;
                }
                updateFeaturedGameCards(); // Update buttons on main page
                // If favorites tab is open, re-render it
                if (document.getElementById('favorites-tab').classList.contains('active')) {
                    renderFavoriteGamesList();
                }
            }
        });
    });
}

// NEW: Function to attach play button listeners
function attachPlayButtonListeners() {
    document.querySelectorAll('.play-button').forEach(button => {
        button.onclick = null; // Remove existing listener to prevent duplicates
        button.addEventListener('click', async function(e) {
            e.preventDefault(); // Prevent default if any
            const currentUser = userManager.getCurrentUser();
            if (!currentUser) {
                await alert('Espere um pouco aí! Primeiro logue para conseguir jogar.');
                return;
            }
            
            const gameTitle = e.target.dataset.gameTitle;
            if (gameTitle) {
                // Navigate to game.html with gameTitle as a query parameter
                window.location.href = `game.html?game=${encodeURIComponent(gameTitle)}`;
            } else {
                alert("Não foi possível iniciar o jogo: título do jogo não encontrado.");
            }
        });
    });
}

// Event Listeners
document.getElementById('profile-link')?.addEventListener('click', function(e) {
    e.preventDefault();
    const currentUser = userManager.getCurrentUser();
    
    if (currentUser) {
        showProfile(currentUser);
    } else {
        // Se não estiver logado, mostra o login
        openLoginModal();
    }
});

document.getElementById('community-link')?.addEventListener('click', function(e) {
    e.preventDefault();
    showCommunity();
});

// NEW: Event listener for "Home" link
document.getElementById('home-link')?.addEventListener('click', function(e) {
    e.preventDefault();
    showMainContent();
});

// NEW: Event listener for "Jogos" link
document.getElementById('games-link')?.addEventListener('click', function(e) {
    e.preventDefault();
    showMainContent(); // "Jogos" also leads to the main games display
});

document.getElementById('switch-to-register-inline')?.addEventListener('click', openRegisterModal);
document.getElementById('switch-to-login-inline')?.addEventListener('click', openLoginModal);
document.getElementById('close-settings-inline')?.addEventListener('click', hideCurrentAuthFormAndShowMainContent);
document.getElementById('close-profile-edit-inline')?.addEventListener('click', closeProfileEdit);

document.getElementById('login-form-inline')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const username = document.getElementById('username-inline').value;
    const password = document.getElementById('password-inline').value;
    
    const result = userManager.login(username, password);
    if (result.success) {
        alert(`Bem-vindo de volta, ${username}!`);
        hideCurrentAuthFormAndShowMainContent(); // Hide login form and show main content
        updateProfileLink();
        updateFeaturedGameCards(); // Update buttons after login
    } else {
        alert(result.message);
    }
});

document.getElementById('register-form-inline')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const username = document.getElementById('reg-username-inline').value;
    const password = document.getElementById('reg-password-inline').value;
    const confirmPassword = document.getElementById('reg-confirm-password-inline').value;

    if (password !== confirmPassword) {
        alert('As senhas não coincidem!');
        return;
    }

    const result = userManager.register(username, password);
    if (result.success) {
        alert('Conta criada com sucesso! Faça login.');
        openLoginModal(); // Go to login after successful registration
    } else {
        alert(result.message);
    }
});

document.getElementById('settings-form-inline')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const currentUsername = userManager.getCurrentUser();
    const currentPassword = document.getElementById('current-password-inline').value;
    const newUsername = document.getElementById('new-username-inline').value.trim();
    const newPassword = document.getElementById('new-password-inline').value;
    const confirmNewPassword = document.getElementById('confirm-new-password-inline').value;

    if (newPassword && newPassword !== confirmNewPassword) {
        alert('As novas senhas não coincidem!');
        return;
    }

    const result = userManager.updateUser(
        currentUsername,
        currentPassword,
        newUsername || null,
        newPassword || null
    );

    if (result.success) {
        alert('Conta atualizada com sucesso!');
        hideCurrentAuthFormAndShowMainContent(); // Hide settings form and show main content
        updateProfileLink();
        updateFeaturedGameCards(); // Update buttons if username changed
    } else {
        alert(result.message);
    }
});

document.getElementById('profile-edit-form-inline')?.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) return;
    
    const bio = document.getElementById('bio-input-inline').value;
    const status = document.getElementById('status-input-inline').value;
    
    profileManager.updateProfile(currentUser, { bio, status });
    
    // Update UI
    document.getElementById('profile-bio').textContent = bio;
    document.querySelector('.profile-status').textContent = `Status: ${status}`;
    
    // Re-render the profile to reflect changes, including the picture if updated
    showProfile(currentUser); // Go back to profile view
    showOnlyAuthSection(''); // Hide the edit section after saving
});

// Event listener for profile picture input
document.getElementById('profile-picture-input')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    const currentUser = userManager.getCurrentUser();
    
    if (file && currentUser) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const base64Image = event.target.result;
            profileManager.updateProfile(currentUser, { profilePicture: base64Image });
            
            // Immediately update the avatar on the edit profile screen (if visible)
            const profileAvatarImg = document.getElementById('profile-avatar-img');
            const avatarPlaceholder = document.getElementById('avatar-placeholder');
            if (profileAvatarImg && avatarPlaceholder) {
                profileAvatarImg.src = base64Image;
                profileAvatarImg.classList.remove('hidden');
                avatarPlaceholder.classList.add('hidden');
            }
        };
        reader.readAsDataURL(file);
    }
});

// Event listener for remove profile picture button
document.getElementById('remove-profile-picture')?.addEventListener('click', function() {
    const currentUser = userManager.getCurrentUser();
    if (currentUser) {
        profileManager.updateProfile(currentUser, { profilePicture: null });
        
        // Clear file input value
        document.getElementById('profile-picture-input').value = '';

        // Immediately update the avatar on the edit profile screen (if visible)
        const profileAvatarImg = document.getElementById('profile-avatar-img');
        const avatarPlaceholder = document.getElementById('avatar-placeholder');
        if (profileAvatarImg && avatarPlaceholder) {
            profileAvatarImg.classList.add('hidden');
            avatarPlaceholder.classList.remove('hidden');
        }
        alert('Foto de perfil removida.');
    }
});

// Event listener for logout button
document.getElementById('logout-button')?.addEventListener('click', logoutUser);

// Event listeners for friend request functionality
document.getElementById('search-users-button')?.addEventListener('click', searchUsers);
document.getElementById('user-search-input')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchUsers();
    }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
    // Hide all secondary sections and auth forms initially
    const profileSection = document.getElementById('profile-section');
    if (profileSection) {
        profileSection.classList.add('hidden');
        profileSection.style.opacity = '0';
    }
    const communitySection = document.getElementById('community-section');
    if (communitySection) {
        communitySection.classList.add('hidden');
        communitySection.style.opacity = '0';
    }

    const sectionsToHideCompletely = ['login-section', 'register-section', 'settings-section', 'profile-edit-section', 'create-blog-form', 'blog-detail', 'blog-list'];
    sectionsToHideCompletely.forEach(id => {
        const section = document.getElementById(id);
        if (section) {
            section.classList.add('hidden');
            section.style.opacity = '0';
        }
    });

    // Only show main content if we are on index.html
    if (window.location.pathname === '/' || window.location.pathname.endsWith('index.html')) {
        showMainContent(); 
        updateProfileLink();
    }
});

// Comunidade - Blog creation
document.getElementById('blog-create-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const title = document.getElementById('blog-title').value;
    const message = document.getElementById('blog-message').value;
    const currentUser = userManager.getCurrentUser();
    
    if (!currentUser) {
        alert('Você precisa estar logado para criar um tópico.');
        return;
    }
    
    communityManager.createBlog(title, message, currentUser);
    document.getElementById('blog-title').value = ''; // Clear title
    document.getElementById('blog-message').value = ''; // Clear message
    hideCreateBlogForm(); // Hide form and show blog list
});

// Comunidade - Message submission
document.getElementById('message-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    if (!communityManager.currentBlog) return;
    
    const message = document.getElementById('reply-message').value;
    const currentUser = userManager.getCurrentUser();
    
    if (!currentUser) {
        alert('Você precisa estar logado para responder.');
        return;
    }
    
    communityManager.addMessage(communityManager.currentBlog.id, message, currentUser);
    document.getElementById('reply-message').value = '';
    loadBlogMessages();
});

function loadBlogs() {
    const blogs = communityManager.getBlogs();
    const container = document.getElementById('blogs-container');
    
    if (!container) return;

    if (blogs.length === 0) {
        container.innerHTML = '<p class="empty-message">Nenhum tópico criado ainda. Seja o primeiro!</p>';
        return;
    }
    
    container.innerHTML = blogs.map(blog => `
        <div class="blog-card" onclick="openBlog(${blog.id})">
            <h4>${escapeHtml(blog.title)}</h4>
            <p class="blog-preview">${escapeHtml(blog.message.substring(0, 100))}${blog.message.length > 100 ? '...' : ''}</p>
            <div class="blog-info">
                <span>Por ${escapeHtml(blog.author)}</span>
                <span>${new Date(blog.createdAt).toLocaleDateString('pt-BR')}</span>
                <span>${blog.messages.length} resposta${blog.messages.length !== 1 ? 's' : ''}</span>
            </div>
        </div>
    `).join('');
}

function openBlog(blogId) {
    const blog = communityManager.getBlog(blogId);
    if (!blog) return;
    
    communityManager.currentBlog = blog;
    
    // Update detail view
    document.getElementById('blog-detail-title').textContent = blog.title;
    document.getElementById('blog-author').textContent = blog.author;
    document.getElementById('blog-date').textContent = new Date(blog.createdAt).toLocaleDateString('pt-BR');
    
    // Load messages
    loadBlogMessages();
    
    // Show detail view and hide blog list
    hideSection(document.getElementById('blog-list')); 
    showOnlyAuthSection('blog-detail'); 
    setActiveNavLink('community-link'); // Keep 'Comunidade' active
}

function hideBlogDetail() {
    showSection(document.getElementById('blog-list')); 
    showOnlyAuthSection(''); 
    communityManager.currentBlog = null;
    setActiveNavLink('community-link'); // Keep 'Comunidade' active
}

function loadBlogMessages() {
    if (!communityManager.currentBlog) return;
    
    const container = document.getElementById('blog-messages-container');
    if (!container) return;

    const messages = [communityManager.currentBlog, ...communityManager.currentBlog.messages];
    
    container.innerHTML = messages.map((item, index) => {
        // Ensure item properties are strings before escaping
        const safeAuthor = typeof item.author === 'string' ? item.author : 'Desconhecido';
        const safeMessage = typeof item.message === 'string' ? item.message : '';
        const timestamp = item.timestamp || item.createdAt;
        return `
            <div class="message-item ${index === 0 ? 'original-message' : ''}">
                <div class="message-header">
                    <strong>${escapeHtml(safeAuthor)}</strong>
                    <span>${new Date(timestamp).toLocaleString('pt-BR')}</span>
                </div>
                <div class="message-content">${escapeHtml(safeMessage)}</div>
            </div>
        `;
    }).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    // Ensure text is treated as a string before setting textContent
    div.textContent = String(text); 
    return div.innerHTML;
}

function showCreateBlogForm() {
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) {
        alert('Você precisa estar logado para criar um tópico.');
        return;
    }
    hideSection(document.getElementById('blog-list')); 
    showOnlyAuthSection('create-blog-form'); 
    setActiveNavLink('community-link'); // Keep 'Comunidade' active
}

function hideCreateBlogForm() {
    showSection(document.getElementById('blog-list')); 
    showOnlyAuthSection(''); 
    document.getElementById('blog-create-form')?.reset();
    setActiveNavLink('community-link'); // Keep 'Comunidade' active
}

// Re-defining these for clarity in global scope if called from HTML inline
window.openLoginModal = openLoginModal;
window.openRegisterModal = openRegisterModal;
window.openSettingsModal = openSettingsModal;

// Re-defining these for clarity in global scope if called from HTML inline
window.hideProfile = hideProfile;
window.showCommunity = showCommunity;
window.hideCommunity = hideCommunity;
window.showCreateBlogForm = showCreateBlogForm;
window.hideCreateBlogForm = hideCreateBlogForm;
window.hideBlogDetail = hideBlogDetail;
window.editProfile = editProfile;
window.closeProfileEdit = closeProfileEdit; 
window.openBlog = openBlog;
window.sendFriendRequest = sendFriendRequest; 
window.acceptFriendRequest = acceptFriendRequest; 
window.declineFriendRequest = declineFriendRequest;