import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductsService } from './products.service.js';

@ApiTags('Productos')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('manage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'CAJERO')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar productos para el personal' })
  findAllForStaff() {
    return this.productsService.findAllForStaff();
  }

  @Get()
  @ApiQuery({
    name: 'categoriaId',
    required: false,
    type: Number,
    description: 'Opcional: filtra los productos por categoría',
  })
  @ApiOperation({
    summary: 'Catálogo público, con filtro opcional por categoría',
  })
  findAllPublic(@Query('categoriaId') categoriaId?: string) {
    if (!categoriaId?.trim()) {
      return this.productsService.findAllPublic();
    }

    const id = Number(categoriaId);

    if (!Number.isInteger(id) || id < 1) {
      throw new BadRequestException('categoriaId debe ser un entero positivo');
    }

    return this.productsService.findAllPublic(id);
  }

  @Get(':id')
  findOnePublic(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOnePublic(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.remove(id);
  }
}
