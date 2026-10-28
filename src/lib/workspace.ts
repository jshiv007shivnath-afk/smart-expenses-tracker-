export const getAccessToken = async (): Promise<string | null> => {
  return localStorage.getItem('smart_expenses_workspace_token') || localStorage.getItem('smart_expenses_user_token');
};

export interface GoogleTaskList {
  id: string;
  title: string;
  updated?: string;
}

export interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  updated?: string;
}

export interface GoogleForm {
  formId: string;
  info: {
    title: string;
    description?: string;
    documentTitle?: string;
  };
  responderUri?: string;
}

export interface GoogleFormResponse {
  responseId: string;
  createTime: string;
  lastSubmittedTime: string;
  answers?: Record<string, any>;
}

// ================= Google Tasks API =================

export async function fetchTaskLists(): Promise<GoogleTaskList[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Google authentication required');

  const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to fetch task lists');
  }

  const data = await res.json();
  return data.items || [];
}

export async function fetchTasks(taskListId: string = '@default'): Promise<GoogleTask[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Google authentication required');

  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks?showCompleted=true&showHidden=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to fetch tasks');
  }

  const data = await res.json();
  return data.items || [];
}

export async function createGoogleTask(
  taskListId: string = '@default',
  task: { title: string; notes?: string; due?: string }
): Promise<GoogleTask> {
  const token = await getAccessToken();
  if (!token) throw new Error('Google authentication required');

  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(task),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to create task');
  }

  return await res.json();
}

export async function updateGoogleTask(
  taskListId: string = '@default',
  taskId: string,
  updates: Partial<GoogleTask>
): Promise<GoogleTask> {
  const token = await getAccessToken();
  if (!token) throw new Error('Google authentication required');

  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to update task');
  }

  return await res.json();
}

export async function deleteGoogleTask(taskListId: string = '@default', taskId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('Google authentication required');

  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to delete task');
  }
}

// ================= Google Forms API =================

export async function createGoogleForm(title: string, description?: string): Promise<GoogleForm> {
  const token = await getAccessToken();
  if (!token) throw new Error('Google authentication required');

  const res = await fetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      info: {
        title,
        documentTitle: title,
        description: description || 'Expense & Budget Form created via Smart Expenses App',
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to create Google Form');
  }

  const form: GoogleForm = await res.json();

  // Add default questions for Expense Reporting
  try {
    await fetch(`https://forms.googleapis.com/v1/forms/${form.formId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            createItem: {
              item: {
                title: 'Expense Title / Merchant Name',
                questionItem: {
                  question: {
                    required: true,
                    textQuestion: { paragraph: false },
                  },
                },
              },
              location: { index: 0 },
            },
          },
          {
            createItem: {
              item: {
                title: 'Amount ($)',
                questionItem: {
                  question: {
                    required: true,
                    textQuestion: { paragraph: false },
                  },
                },
              },
              location: { index: 1 },
            },
          },
          {
            createItem: {
              item: {
                title: 'Category (e.g., Food, Travel, Shopping, Bills)',
                questionItem: {
                  question: {
                    required: false,
                    textQuestion: { paragraph: false },
                  },
                },
              },
              location: { index: 2 },
            },
          },
          {
            createItem: {
              item: {
                title: 'Additional Notes / Receipt URL',
                questionItem: {
                  question: {
                    required: false,
                    textQuestion: { paragraph: true },
                  },
                },
              },
              location: { index: 3 },
            },
          },
        ],
      }),
    });
  } catch (e) {
    console.warn('Could not add default questions to form:', e);
  }

  return form;
}

export async function fetchGoogleForm(formId: string): Promise<GoogleForm> {
  const token = await getAccessToken();
  if (!token) throw new Error('Google authentication required');

  const res = await fetch(`https://forms.googleapis.com/v1/forms/${formId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to fetch Google Form');
  }

  return await res.json();
}

export async function fetchGoogleFormResponses(formId: string): Promise<GoogleFormResponse[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Google authentication required');

  const res = await fetch(`https://forms.googleapis.com/v1/forms/${formId}/responses`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to fetch form responses');
  }

  const data = await res.json();
  return data.responses || [];
}
