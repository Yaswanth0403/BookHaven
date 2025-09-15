require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// User Schema and Model
const userSchema = new mongoose.Schema({
    firstname: String,
    lastname: String,
    email: String,
    phone: String,
    age: Number,
    gender: String,
    address: String,
    password: String
});
const User = mongoose.model('User', userSchema);

// Admin Schema and Model
const adminSchema = new mongoose.Schema({
    name: String,
    password: String,
    lastname: String,
    email: String,
    phone: String,
    age: Number,
    gender: String,
    address: String
});
const Admin = mongoose.model('Admin', adminSchema, 'main_users'); // Uses 'main_users' collection for admin

// Book Schema and Model
const bookSchema = new mongoose.Schema({
    bookId: String,
    bookName: String,
    price: Number,
    description: String,
    authorName: String,
    quantity: Number,
    image: String,
    bookType: String // This field is included to differentiate book types
});
const Book = mongoose.model('Book', bookSchema);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

// Routes
app.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/home');
    } else {
        res.redirect('/login.html');
    }
});

// Registration Route
app.post('/register', async (req, res) => {
    try {
        const { name, lastname, email, phone, age, gender, add, psw } = req.body;

        const newUser = new User({
            firstname: name,
            lastname: lastname,
            email: email,
            phone: phone,
            age: parseInt(age, 10),
            gender: gender,
            address: add,
            password: psw
        });

        await newUser.save();

        // Creating user-specific collections
        const userOrdersCollection = `myorders_${name}`;
        const userCartCollection = `mycart_${name}`;

        await mongoose.connection.db.createCollection(userOrdersCollection);
        await mongoose.connection.db.createCollection(userCartCollection);

        // Redirect to login page after successful registration
        res.redirect('/login.html');
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).send('<h1>Error: ' + error.message + '</h1>');
    }
});

// Login Route
app.post('/login', async (req, res) => {
    try {
        const { name, psw } = req.body;
        const user = await User.findOne({ firstname: name, password: psw });

        if (user) {
            req.session.user = {
                firstname: user.firstname,
                lastname: user.lastname,
                email: user.email,
                phone: user.phone,
                age: user.age,
                address: user.address,
                gender: user.gender
            };

            console.log('User session:', req.session.user);
            res.redirect('/home');
        } else {
            res.status(401).send('<h1>Invalid Username or Password</h1><a href="/login.html">Try Again</a>');
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send('<h1>Error: ' + error.message + '</h1>');
    }
});

// POST route for adding books
app.post('/books/add', async (req, res) => {
    try {
        const { bookId, bookName, price, description, authorName, quantity, image, bookType } = req.body;

        const newBook = new Book({
            bookId,
            bookName,
            price,
            description,
            authorName,
            quantity,
            image,
            bookType // Use the bookType received from the form
        });

        await newBook.save();
        console.log('New book added:', newBook);

        // Redirect to admin home after successful addition
        res.redirect('/admin/home'); // Adjust the redirect as needed
    } catch (error) {
        console.error('Error adding book:', error);
        res.status(500).send('<h1>Error: ' + error.message + '</h1>');
    }
});

// Route to get all books
app.get('/books', async (req, res) => {
    try {
        const books = await Book.find({});
        res.json(books);
    } catch (error) {
        console.error('Error fetching books:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// API Route to get all books as JSON
app.get('/api/books', async (req, res) => {
    try {
        const books = await Book.find({});
        res.json(books);
    } catch (error) {
        console.error('Error fetching books:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// PUT route to update book quantity
app.put('/books/update/:id', async (req, res) => {
    const bookId = req.params.id;
    const { quantity } = req.body;

    try {
        const updatedBook = await Book.findOneAndUpdate(
            { bookId: bookId }, // Find book by bookId
            { quantity: quantity }, // Update quantity
            { new: true } // Return the updated document
        );

        if (updatedBook) {
            console.log('Book quantity updated:', updatedBook);
            res.status(200).json(updatedBook);
        } else {
            res.status(404).send('Book not found');
        }
    } catch (error) {
        console.error('Error updating book quantity:', error);
        res.status(500).send('Internal Server Error');
    }
});

// API Route to get user details
app.get('/api/user', (req, res) => {
    if (req.session.user) {
        res.json(req.session.user);
    } else {
        res.status(401).json({ error: 'User not authenticated' });
    }
});

// API Route to get admin details
app.get('/api/admin', (req, res) => {
    if (req.session.admin) {
        res.json(req.session.admin);
    } else {
        res.status(401).json({ error: 'Admin not authenticated' });
    }
});

// Homepage Route
app.get('/home', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login.html');
    }
    res.sendFile(path.join(__dirname, 'public', 'homepage.html'));
});

// Contact Route
app.post('/contact', async (req, res) => {
    try {
        const { name, subject, description } = req.body;

        const newContact = new Contact({
            name: name,
            subject: subject,
            description: description,
        });

        await newContact.save();
        console.log('Contact details saved:', newContact);

        res.sendFile(path.join(__dirname, 'public', 'homepage.html'));
    } catch (error) {
        console.error('Error during contact form submission:', error);
        res.status(500).send('<h1>Error: ' + error.message + '</h1>');
    }
});

// Admin Login Route
app.post('/adminlogin', async (req, res) => {
    try {
        const { name, psw } = req.body;
        const admin = await Admin.findOne({ name, password: psw });

        if (admin) {
            req.session.admin = { 
                name: admin.name,
                lastname: admin.lastname,
                email: admin.email,
                phone: admin.phone,
                age: admin.age,
                address: admin.address,
                gender: admin.gender
            };
            res.redirect('/admin/home');
        } else {
            res.status(401).send('<h1>Invalid Admin Credentials</h1><a href="/adminlogin.html">Try Again</a>');
        }
    } catch (error) {
        console.error('Error during admin login:', error);
        res.status(500).send('<h1>Error: ' + error.message + '</h1>');
    }
});

// Add Contact Schema and Model
const contactSchema = new mongoose.Schema({
    firstname: String,
    subject: String,
    description: String
});
const Contact = mongoose.model('Contact', contactSchema, 'contacts'); // Replace 'contacts' with your collection name

// Route to fetch all contacts from MongoDB
app.get('/api/contacts', async (req, res) => {
    try {
        const contacts = await Contact.find({});
        res.json(contacts);
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// Admin Home Route
app.get('/admin/home', (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/adminlogin.html');
    }
    res.sendFile(path.join(__dirname, 'public', 'adminhome.html'));
});

// Route to get inspirational books
app.get('/api/books/inspiration', async (req, res) => {
    try {
        const inspirationalBooks = await Book.find({ bookType: 'inspiration' });
        res.json(inspirationalBooks);
    } catch (error) {
        console.error('Error fetching inspirational books:', error);
        res.status(500).json({ message: "Error fetching books", error });
    }
});

app.get('/api/books/adventure', async (req, res) => {
    try {
        const inspirationalBooks = await Book.find({ bookType: 'adventure' });
        res.json(inspirationalBooks);
    } catch (error) {
        console.error('Error fetching adventure books:', error);
        res.status(500).json({ message: "Error fetching books", error });
    }
});

app.get('/api/books/fantasy', async (req, res) => {
    try {
        const inspirationalBooks = await Book.find({ bookType: 'fantasy' });
        res.json(inspirationalBooks);
    } catch (error) {
        console.error('Error fetching fantasy books:', error);
        res.status(500).json({ message: "Error fetching books", error });
    }
});

app.get('/api/books/suspense', async (req, res) => {
    try {
        const inspirationalBooks = await Book.find({ bookType: 'suspense' });
        res.json(inspirationalBooks);
    } catch (error) {
        console.error('Error fetching suspense books:', error);
        res.status(500).json({ message: "Error fetching books", error });
    }
});



// API route to add a book to the user's cart
app.post('/api/cart/add', async (req, res) => {
    const userId = req.session.user.firstname; // Using the user's first name as ID
    const { bookId, bookName, price, quantity ,image } = req.body;

    if (!userId) {
        return res.status(400).json({ message: "User ID is required." });
    }

    try {
        const newCartItem = new Cart({
            userId,
            bookId,
            bookName,
            price,
            quantity,
            image
        });

        await newCartItem.save();
        res.json({ message: "Item added to cart successfully!" });
    } catch (error) {
        console.error("Error adding item to cart:", error);
        res.status(500).json({ message: "Error adding item to cart", error: error.message });
    }
});

const cartSchema = new mongoose.Schema({
    userId: String,
    bookId: String,
    bookName: String,
    price: Number,
    quantity: Number,
    image: String
});
const Cart = mongoose.model('Cart', cartSchema);


// API route to get items in the user's cart
app.get('/api/cart', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = req.session.user.firstname; // Using the user's first name as ID
    try {
        const cartItems = await Cart.find({ userId });
        res.json(cartItems);
    } catch (error) {
        console.error("Error fetching cart items:", error);
        res.status(500).json({ message: "Error fetching cart items" });
    }
});

app.get('/api/orders', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.session.user.firstname;
    try {
        const orders = await mongoose.connection.db.collection(`myorders_${userId}`).find().toArray();
        res.status(200).json(orders);
    } catch (error) {
        console.error("Error retrieving orders:", error);
        res.status(500).json({ message: "Error retrieving orders", error: error.message });
    }
});


app.post('/api/cart/buy', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.session.user.firstname; // Assuming the user is identified by first name
    try {
        // Fetch cart items for the user
        const cartItems = await Cart.find({ userId });

        if (cartItems.length === 0) {
            return res.status(400).json({ message: "Your cart is empty." });
        }

        // Prepare orders and update book quantities
        const orders = cartItems.map(item => ({
            userId,
            bookId: item.bookId,
            bookName: item.bookName,
            price: item.price,
            quantity: item.quantity,
            image:item.image,
            date: new Date()
        }));

        // Insert orders into the myorders collection
        await mongoose.connection.db.collection(`myorders_${userId}`).insertMany(orders);

        // Decrease the quantity in the books collection
        const bookUpdates = cartItems.map(async item => {
            await Book.updateOne(
                { bookId: item.bookId },
                { $inc: { quantity: -item.quantity } } // Decrease quantity by the cart quantity
            );
        });
        await Promise.all(bookUpdates); // Wait for all updates to complete

        // Clear the user's cart after purchase
        await Cart.deleteMany({ userId });

        res.status(200).json({ message: "Purchase successful!" });
    } catch (error) {
        console.error("Error processing purchase:", error);
        res.status(500).json({ message: "Error processing purchase", error: error.message });
    }
});

// API route to remove a book from the user's cart
app.delete('/api/cart/remove/:bookId', async (req, res) => {
    const userId = req.session.user.firstname; // Assuming the user is identified by their first name
    const { bookId } = req.params; // Extract bookId from the request parameters

    if (!userId) {
        return res.status(400).json({ message: "User ID is required." });
    }

    try {
        // Find and remove the cart item with the specified bookId and userId
        const result = await Cart.deleteOne({ userId, bookId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "Book not found in cart." });
        }

        res.json({ message: "Book removed from cart successfully!" });
    } catch (error) {
        console.error("Error removing item from cart:", error);
        res.status(500).json({ message: "Error removing item from cart", error: error.message });
    }
});


// Admin page to add books
app.get('/addbooks', (req, res) => {    
    if (!req.session.admin) {
        return res.redirect('/adminlogin.html');
    }
    res.sendFile(path.join(__dirname, 'public', 'addbooks.html'));
});

// Admin Route to View Users
app.get('/admin/users', (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/adminlogin.html');
    }
    res.sendFile(path.join(__dirname, 'public', 'users.html'));
});

// Logout for Admins
app.get('/admin/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('<h1>Error during logout</h1>');
        }
        res.redirect('/adminlogin.html');
    });
});

// Route to fetch all users from MongoDB
app.get('/users', async (req, res) => {
    try {
        const users = await User.find({});
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});