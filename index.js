import express from 'express'
import { Server } from "socket.io"
import path from 'path' 
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename) //мы пишем это чтобы данные воспроизводить через "type": "module" в package.json

const PORT = process.env.PORT || 3500
const ADMIN = "Admin"

const app = express()

app.use(express.static(path.join(__dirname, "public")))

const expressServer = app.listen(PORT, () => {
    console.log(`listening on port ${PORT}`)
})

//Статус юзера
const UsersState = {
    users: [],
    setUsers: function (newUsersArray) {
        this.users = newUsersArray
    }
}

const io = new Server(expressServer, {
    cors: { //cross origin resource sharing
        origin: process.env.NODE_ENV === "production" ? false : ["http://localhost:5500","http://127.0.0.1:5500"]
    }
})

io.on('connection', socket => {
    console.log(`User ${socket.id} присойденлися, значит все круто`) //штука чтобы в терминале видеть присойденился ли человек

        //Показывает сообщение только человеку который зашел
        socket.emit('message', buildMsg(ADMIN, "Добро пожаловать в ONLINE CHAT!"))

        socket.on('enterRoom', ({name, room }) => {

        //вийти из чата в котором был юзер
        const prevRoom = getUser(socket.id)?.room
        
        if (prevRoom) {
            socket.leave(prevRoom)
            io.to(prevRoom).emit('message', buildMsg(ADMIN, `${name} покинул чат`))
        }

        const user = activateUser(socket.id, name, room)

        //Не может обновить предыдущий чат списка юзеров до тех пор пока статус активности юзера не обновиться 
        if (prevRoom) {
            io.to(prevRoom).emit('userList', {
                users: getUsersInRoom(prevRoom)
            })
        }

        //юзер зашел в чат
        socket.join(user.room)

        // Сообщение юзеру который присойденился
        socket.emit('message', buildMsg(ADMIN, `Вы присойденились ${user.room} чат комнате`))

        //Сообщение всем остальным кто в  находиться чате
        socket.broadcast.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} присойденился к чату`))
        
        //Обновляет юзер лист для чата
        io.to(user.room).emit('userList', {
            users:getUsersInRoom(user.room)
        })

        //Обновляет лист юзеров всем
        io.emit('roomList', {
            rooms: getAllActiveRooms()
        }) 
})

    //Когда человек выходит отображаем сообщение всем остальным людям
    socket.on('disconnect', () => {
        const user = getUser(socket.id)
        userLeavesApp(socket.id)

        if (user)  {
            io.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} покинул чат`))

            io.to(user.room).emit('userList', {
                users: getUsersInRoom(user.room)
            })

            io.emit('roomList', {
                rooms: getAlllActiveRooms()
            })
        }

        console.log(`User $(socket.id)? disconnected so all works fine`)
    })


    //Ждет ивента для сообщения
        socket.on('message', ({name, text }) => { 
            const room = getUser(socket.id)?.room
            if (room) {
                io.to(room).emit('message', buildMsg(name, text))
            }
        })

    //Просматривает пишет ли человек
    socket.on('activity', (name) => {
        const room = getUser(socket.id)?.room
        if (room) {
            socket.broadcast.to(room).emit('activity', name)
        }
    })
})

function buildMsg(name, text) { //функция которая отображает имя отправителя, текст отправителя и время отправки сообщения
    return{
        name,
        text,
        time: new Intl.DateTimeFormat('default', {
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric'
        }).format(new Date())
    }
}

//фунции пользователя
function activateUser(id, name, room) { //когда активируется 
    const user = { id, name, room}
    UsersState.setUsers([
        ...UsersState.users.filter(user => user.id !== id),
        user
    ])
    return user
}

function userLeavesApp(id) { //когда юзер выходит с приложения
    UsersState.setUsers(
        UsersState.users.filter(user => user.id !== id)
    )
}

function getUser(id) { //функция на поиск юзера
    return UsersState.users.find(user => user.id === id)
}

function getUsersInRoom(room) { //функция на то чтобы отображались учасники в чате
    return UsersState.users.filter(user => user.room === room)
}

function getAllActiveRooms() { //функция которая отображает все активные чаты
    return Array.from(new Set(UsersState.users.map(user => user.room)))
}


