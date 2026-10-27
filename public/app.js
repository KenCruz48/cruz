let token = '';

const loginForm =
  document.getElementById('login-form');

const loginEmail =
  document.getElementById('login-email');

const loginPassword =
  document.getElementById('login-password');

const loginButton =
  document.getElementById('login-button');

const loginMessage =
  document.getElementById('login-message');

const registrationSection =
  document.getElementById('registration-section');

const registrationForm =
  document.getElementById('registration-form');

const userName =
  document.getElementById('user-name');

const eventsSelect =
  document.getElementById('events-select');

const categoriesSelect =
  document.getElementById('categories-select');

const registerButton =
  document.getElementById('register-button');

const refreshButton =
  document.getElementById('refresh-data-button');

const statusMessage =
  document.getElementById('status-message');


async function apiRequest(
  url,
  options = {}
) {
  const headers = {
    ...options.headers,
  };

  if (options.body !== undefined) {
    headers['Content-Type'] =
      'application/json';
  }

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  const response =
    await fetch(
      url,
      {
        ...options,
        headers,
      }
    );

  let body = {};

  try {
    body =
      await response.json();
  } catch {
    body = {};
  }

  if (!response.ok) {
    throw new Error(
      body.message ||
      `Error HTTP ${response.status}`
    );
  }

  return body;
}


function showMessage(
  element,
  message,
  type
) {
  element.textContent =
    message;

  element.className =
    `message ${type}`;
}


async function loadEvents() {
  const body =
    await apiRequest(
      '/api/v1/events?page=1&limit=100'
    );

  const events =
    body.data?.events || [];

  eventsSelect.innerHTML =
    '<option value="">Seleccione un evento</option>';

  for (const event of events) {
    if (event.status !== 'active') {
      continue;
    }

    const option =
      document.createElement('option');

    option.value =
      event._id || event.id;

    option.textContent =
      `${event.name} - ${event.location}`;

    eventsSelect.appendChild(option);
  }
}


async function loadCategories() {
  const body =
    await apiRequest(
      '/api/v1/categories?page=1&limit=100&status=active'
    );

  const categories =
    body.data?.categories || [];

  categoriesSelect.innerHTML =
    '<option value="">Seleccione una categoría</option>';

  for (const category of categories) {
    const option =
      document.createElement('option');

    option.value =
      category._id || category.id;

    option.textContent =
      category.name;

    categoriesSelect.appendChild(option);
  }
}


async function loadRaceData() {
  statusMessage.textContent = '';

  try {
    await Promise.all([
      loadEvents(),
      loadCategories(),
    ]);
  } catch (error) {
    showMessage(
      statusMessage,
      error.message,
      'error'
    );
  }
}


loginForm.addEventListener(
  'submit',
  async event => {
    event.preventDefault();

    loginButton.disabled = true;

    showMessage(
      loginMessage,
      'Iniciando sesión...',
      'info'
    );

    try {
      const body =
        await apiRequest(
          '/api/v1/users/login',
          {
            method: 'POST',

            body:
              JSON.stringify({
                email:
                  loginEmail.value,

                password:
                  loginPassword.value,
              }),
          }
        );

      token =
        body.data.token;

      userName.textContent =
        body.data.user.name;

      showMessage(
        loginMessage,
        'Inicio de sesión correcto',
        'success'
      );

      registrationSection.hidden =
        false;

      await loadRaceData();

    } catch (error) {
      token = '';

      registrationSection.hidden =
        true;

      showMessage(
        loginMessage,
        error.message,
        'error'
      );

    } finally {
      loginButton.disabled =
        false;
    }
  }
);


refreshButton.addEventListener(
  'click',
  async () => {
    refreshButton.disabled =
      true;

    await loadRaceData();

    refreshButton.disabled =
      false;
  }
);


registrationForm.addEventListener(
  'submit',
  async event => {
    event.preventDefault();

    const eventId =
      eventsSelect.value;

    const categoryId =
      categoriesSelect.value;

    if (!eventId || !categoryId) {
      showMessage(
        statusMessage,
        'Debe seleccionar evento y categoría',
        'error'
      );

      return;
    }

    registerButton.disabled =
      true;

    showMessage(
      statusMessage,
      'Registrando inscripción...',
      'info'
    );

    try {
      const body =
        await apiRequest(
          '/api/v1/registrations',
          {
            method: 'POST',

            body:
              JSON.stringify({
                eventId,
                categoryId,
              }),
          }
        );

      showMessage(
        statusMessage,
        body.message ||
        'Inscripción registrada correctamente',
        'success'
      );

    } catch (error) {
      showMessage(
        statusMessage,
        error.message,
        'error'
      );

    } finally {
      registerButton.disabled =
        false;
    }
  }
);