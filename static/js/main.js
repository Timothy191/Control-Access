// Mine Management System - Main JavaScript

// Modal functions
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Close modal on backdrop click
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// Close modal on escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    }
});

// Form validation
function validateForm(form) {
    const required = form.querySelectorAll('[required]');
    let valid = true;
    
    required.forEach(field => {
        if (!field.value.trim()) {
            valid = false;
            field.style.borderColor = '#ff1744';
        } else {
            field.style.borderColor = '';
        }
    });
    
    return valid;
}

// Initialize tooltips
document.addEventListener('DOMContentLoaded', function() {
    // Auto-hide notifications after 3 seconds
    setTimeout(() => {
        document.querySelectorAll('.notification').forEach(n => {
            n.style.opacity = '0';
            setTimeout(() => n.remove(), 300);
        });
    }, 3000);
});

// AJAX helper
function ajax(url, options = {}) {
    return fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': options.apiKey || ''
        },
        ...options
    }).then(r => r.json());
}
