const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();

// Database connection
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ngo_website'
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
    } else {
        console.log('Connected to MySQL database');
    }
});

// Middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: 'ngo_secret_key_2024',
    resave: false,
    saveUninitialized: false
}));

// File upload configuration
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Auth middleware
function isAuthenticated(req, res, next) {
    if (req.session.admin) {
        next();
    } else {
        res.redirect('/admin/login');
    }
}

// PUBLIC ROUTES

// Home page
app.get('/', (req, res) => {
    const queries = {
        banners: 'SELECT * FROM banners WHERE status = 1 ORDER BY display_order',
        vision_mission: 'SELECT * FROM vision_mission LIMIT 1',
        statistics: 'SELECT * FROM statistics WHERE status = 1 ORDER BY display_order',
        initiatives: 'SELECT * FROM initiatives WHERE status = 1 ORDER BY display_order LIMIT 4'
    };

    const data = {};

    db.query(queries.banners, (err, banners) => {
        if (err) throw err;
        data.banners = banners;

        db.query(queries.vision_mission, (err, vm) => {
            if (err) throw err;
            data.vision_mission = vm[0] || {};

            db.query(queries.statistics, (err, stats) => {
                if (err) throw err;
                data.statistics = stats;

                db.query(queries.initiatives, (err, initiatives) => {
                    if (err) throw err;
                    data.initiatives = initiatives;

                    res.render('frontend/home', data);
                });
            });
        });
    });
});

// ADMIN ROUTES

// Admin login page
app.get('/admin/login', (req, res) => {
    res.render('admin/login', { error: null });
});

// Admin login POST
app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;

    db.query('SELECT * FROM admin WHERE username = ?', [username], async (err, results) => {
        if (err) throw err;

      if (results.length > 0) {
    const admin = results[0];

    if (password === 'admin123') {
        req.session.admin = admin;
        res.redirect('/admin/dashboard');
    } else {
        res.render('admin/login', { error: 'Invalid credentials' });
    }
}

    });
});

// Admin dashboard
app.get('/admin/dashboard', isAuthenticated, (req, res) => {
    res.render('admin/dashboard');
});

// Admin logout
app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

// BANNER MANAGEMENT
app.get('/admin/banners', isAuthenticated, (req, res) => {
    db.query('SELECT * FROM banners ORDER BY display_order', (err, banners) => {
        if (err) throw err;
        res.render('admin/banners', { banners });
    });
});

app.post('/admin/banners/add', isAuthenticated, upload.single('image'), (req, res) => {
    const { title, description, display_order } = req.body;
    const image_url = '/uploads/' + req.file.filename;

    db.query('INSERT INTO banners (image_url, title, description, display_order) VALUES (?, ?, ?, ?)',
        [image_url, title, description, display_order], (err) => {
            if (err) throw err;
            res.redirect('/admin/banners');
        });
});

app.post('/admin/banners/update/:id', isAuthenticated, upload.single('image'), (req, res) => {
    const { id } = req.params;
    const { title, description, display_order, status } = req.body;

    if (req.file) {
        const image_url = '/uploads/' + req.file.filename;
        db.query('UPDATE banners SET image_url = ?, title = ?, description = ?, display_order = ?, status = ? WHERE id = ?',
            [image_url, title, description, display_order, status || 1, id], (err) => {
                if (err) throw err;
                res.redirect('/admin/banners');
            });
    } else {
        db.query('UPDATE banners SET title = ?, description = ?, display_order = ?, status = ? WHERE id = ?',
            [title, description, display_order, status || 1, id], (err) => {
                if (err) throw err;
                res.redirect('/admin/banners');
            });
    }
});

app.get('/admin/banners/delete/:id', isAuthenticated, (req, res) => {
    db.query('UPDATE banners SET status = 0 WHERE id = ?', [req.params.id], (err) => {
        if (err) throw err;
        res.redirect('/admin/banners');
    });
});

// VISION MISSION MANAGEMENT
app.get('/admin/vision-mission', isAuthenticated, (req, res) => {
    db.query('SELECT * FROM vision_mission LIMIT 1', (err, data) => {
        if (err) throw err;
        res.render('admin/vision-mission', { data: data[0] || {} });
    });
});

app.post('/admin/vision-mission/update', isAuthenticated, (req, res) => {
    const { vision_title, vision_description, mission_title, mission_description } = req.body;

    db.query('SELECT COUNT(*) as count FROM vision_mission', (err, result) => {
        if (err) throw err;

        if (result[0].count === 0) {
            db.query('INSERT INTO vision_mission (vision_title, vision_description, mission_title, mission_description) VALUES (?, ?, ?, ?)',
                [vision_title, vision_description, mission_title, mission_description], (err) => {
                    if (err) throw err;
                    res.redirect('/admin/vision-mission');
                });
        } else {
            db.query('UPDATE vision_mission SET vision_title = ?, vision_description = ?, mission_title = ?, mission_description = ?',
                [vision_title, vision_description, mission_title, mission_description], (err) => {
                    if (err) throw err;
                    res.redirect('/admin/vision-mission');
                });
        }
    });
});

// STATISTICS MANAGEMENT
app.get('/admin/statistics', isAuthenticated, (req, res) => {
    db.query('SELECT * FROM statistics ORDER BY display_order', (err, statistics) => {
        if (err) throw err;
        res.render('admin/statistics', { statistics });
    });
});

app.post('/admin/statistics/add', isAuthenticated, (req, res) => {
    const { label, value, display_order } = req.body;

    db.query('INSERT INTO statistics (label, value, display_order) VALUES (?, ?, ?)',
        [label, value, display_order], (err) => {
            if (err) throw err;
            res.redirect('/admin/statistics');
        });
});

app.post('/admin/statistics/update/:id', isAuthenticated, (req, res) => {
    const { id } = req.params;
    const { label, value, display_order, status } = req.body;

    db.query('UPDATE statistics SET label = ?, value = ?, display_order = ?, status = ? WHERE id = ?',
        [label, value, display_order, status || 1, id], (err) => {
            if (err) throw err;
            res.redirect('/admin/statistics');
        });
});

app.get('/admin/statistics/delete/:id', isAuthenticated, (req, res) => {
    db.query('UPDATE statistics SET status = 0 WHERE id = ?', [req.params.id], (err) => {
        if (err) throw err;
        res.redirect('/admin/statistics');
    });
});

// INITIATIVES MANAGEMENT
app.get('/admin/initiatives', isAuthenticated, (req, res) => {
    db.query('SELECT * FROM initiatives ORDER BY display_order', (err, initiatives) => {
        if (err) throw err;
        res.render('admin/initiatives', { initiatives });
    });
});

app.post('/admin/initiatives/add', isAuthenticated, upload.single('image'), (req, res) => {
    const { title, description, display_order } = req.body;
    const image_url = '/uploads/' + req.file.filename;

    db.query('INSERT INTO initiatives (title, description, image_url, display_order) VALUES (?, ?, ?, ?)',
        [title, description, image_url, display_order], (err) => {
            if (err) throw err;
            res.redirect('/admin/initiatives');
        });
});

app.post('/admin/initiatives/update/:id', isAuthenticated, upload.single('image'), (req, res) => {
    const { id } = req.params;
    const { title, description, display_order, status } = req.body;

    if (req.file) {
        const image_url = '/uploads/' + req.file.filename;
        db.query('UPDATE initiatives SET title = ?, description = ?, image_url = ?, display_order = ?, status = ? WHERE id = ?',
            [title, description, image_url, display_order, status || 1, id], (err) => {
                if (err) throw err;
                res.redirect('/admin/initiatives');
            });
    } else {
        db.query('UPDATE initiatives SET title = ?, description = ?, display_order = ?, status = ? WHERE id = ?',
            [title, description, display_order, status || 1, id], (err) => {
                if (err) throw err;
                res.redirect('/admin/initiatives');
            });
    }
});

app.get('/admin/initiatives/delete/:id', isAuthenticated, (req, res) => {
    db.query('UPDATE initiatives SET status = 0 WHERE id = ?', [req.params.id], (err) => {
        if (err) throw err;
        res.redirect('/admin/initiatives');
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});