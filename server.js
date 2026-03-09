require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ОШИБКА: Не найдены SUPABASE_URL или SUPABASE_KEY в .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

const normalizeBook = (book) => ({
  ...book,
  id: Number(book.id)
});

app.post('/api/debug', (req, res) => {
  console.log('DEBUG POST received:', JSON.stringify(req.body, null, 2));
  res.json({ received: req.body });
});

app.get('/api/books', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .order('id', { ascending: false });

    if (error) throw error;

    const books = data ? data.map(normalizeBook) : [];
    console.log(`★ GET /api/books: отправляю ${books.length} книг`);
    res.json(books);
  } catch (err) {
    console.error('❌ Ошибка чтения СУБЕЙС:', err.message);
    res.status(500).json({ error: 'Ошибка базы данных', details: err.message });
  }
});

app.post('/api/books', async (req, res) => {
  console.log('★ POST body:', JSON.stringify(req.body));
  
  const { title, author, description, rating, coverUrl } = req.body;
  
  if (!title || !description || typeof rating !== 'number' || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Неверные данные книги' });
  }
  
  try {
    const { data, error } = await supabase
      .from('books')
      .insert([{
        title: String(title || '').trim(),
        author: String(author || '').trim(), 
        description: String(description || '').trim(),
        rating: Number(rating),
        coverUrl: String(coverUrl || '').trim()
      }])
      .select()
      .single();

    if (error) {
      // 🔥 ВАЖНО: Выводим полную ошибку от Supabase в консоль
      console.error('❌ СУПЕР-ОШИБКА SUPABASE:', JSON.stringify(error, null, 2));
      throw error;
    }

    const newBook = normalizeBook(data);
    console.log('✅ Книга добавлена:', newBook.title);
    res.status(201).json(newBook); 
  } catch (err) {
    console.error('❌ Ошибка записи СУБЕЙС:', err.message);
    res.status(500).json({ error: 'Ошибка сохранения', details: err.message });
  }
});

app.put('/api/books/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { title, author, description, rating, coverUrl } = req.body;
  
  if (!title || !description || typeof rating !== 'number' || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Неверные данные книги' });
  }
  
  try {
    const { data, error } = await supabase
      .from('books')
      .update({
        title: String(title || '').trim(),
        author: String(author || '').trim(), 
        description: String(description || '').trim(),
        rating: Number(rating),
        coverUrl: String(coverUrl || '').trim()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ СУПЕР-ОШИБКА SUPABASE (UPDATE):', JSON.stringify(error, null, 2));
      throw error;
    }
    if (!data) return res.status(404).json({ error: 'Книга не найдена' });

    const updatedBook = normalizeBook(data);
    console.log('✅ Книга обновлена:', updatedBook.title);
    res.json(updatedBook);
  } catch (err) {
    console.error('❌ Ошибка обновления СУБЕЙС:', err.message);
    res.status(500).json({ error: 'Ошибка обновления', details: err.message });
  }
});

app.delete('/api/books/:id', async (req, res) => {
  const id = Number(req.params.id);
  
  try {
    const { data: existing } = await supabase.from('books').select('id').eq('id', id).single();
    if (!existing) {
      return res.status(404).json({ error: 'Книга не найдена' });
    }

    const { error } = await supabase
      .from('books')
      .delete()
      .eq('id', id);

    if (error) throw error;

    console.log(`✅ Книга ${id} удалена`);
    res.json({ status: 'deleted', id: id });
  } catch (err) {
    console.error('❌ Ошибка удаления СУБЕЙС:', err.message);
    res.status(500).json({ error: 'Ошибка удаления', details: err.message });
  }
});

app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.sendFile(path.join(__dirname, 'front.html'));
});

app.get('/test', (req, res) => {
  res.send('★ OK ' + Date.now());
});

app.listen(PORT, () => {
  console.log(`\n★ Сервер запущен: http://localhost:${PORT}`);
  console.log(`★ Тест: http://localhost:${PORT}/test`);
  console.log(`★ База данных: Supabase (${supabaseUrl})\n`);
});