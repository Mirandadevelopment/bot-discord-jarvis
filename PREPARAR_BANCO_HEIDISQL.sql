-- --------------------------------------------------------
-- SCRIPT DE PREPARAÇÃO DO BANCO DE DADOS (HEIDISQL)
-- Rode este script no seu HeidiSQL ANTES de iniciar o bot
-- --------------------------------------------------------

-- 1. Criar o banco de dados se não existir
CREATE DATABASE IF NOT EXISTS `Atendimento` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Garantir que o usuário 'miranda' tenha acesso total
-- Substitua 'miranda' pela senha que você deseja usar
CREATE USER IF NOT EXISTS 'miranda'@'localhost' IDENTIFIED BY 'miranda';
GRANT ALL PRIVILEGES ON `Atendimento`.* TO 'miranda'@'localhost';
FLUSH PRIVILEGES;

USE `Atendimento`;

-- 3. O bot criará as tabelas automaticamente ao iniciar, 
-- mas se você quiser garantir, aqui está a tabela principal:
CREATE TABLE IF NOT EXISTS `bot_license_users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `openId` varchar(64) NOT NULL,
  `discordId` varchar(64) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `email` varchar(320) DEFAULT NULL,
  `role` enum('prospect','client','admin') DEFAULT 'prospect',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `openId` (`openId`),
  UNIQUE KEY `discordId` (`discordId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- FIM DO SCRIPT
-- --------------------------------------------------------
