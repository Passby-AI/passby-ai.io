---
title: 从实现一个Vector3f向量类，深入了解运算符重载
tags:
  - cpp
  - vector3f
  - operator-overloading
  - friend-function
  - cmake
categories:
  - C++
  - 计算机图形学
aliases: []
created: 2026-02
draft: false
slug: 从实现一个vector3f向量类-深入了解运算符重载
status: archived
---
## 问题

* **练习A：实现一个`Vector3f`向量类。**

* **目标：** 这是图形学编程的“Hello World”。

* **要求：** 创建一个`Vector3f.h`和`.cpp`，类中包含`float x, y, z;`三个成员。您需要为它实现：

  1. 构造函数（`Vector3f(float x, float y, float z)`）。

  2. 成员函数，如计算向量长度`length()`和归一化`normalize()`。

  3. **操作符重载(Operator Overloading)：** 实现向量的加法 (`+`)、减法 (`-`)、与标量的乘法 (`*`)。这是C++在图形学中应用极广的特性。

***

## 实现与思考过程

### 前期思考

* 首先要明确，一个向量类到底有哪些基础的属性，方法，向量的运算法则有哪些。这里已经给出了`float x, y, z`三个成员，顺着这个思路，选用标准正交基，并且表示为(x,y,z）的形式（这在后面打印时会用到）。回想数学课中学到的向量的基本运算，有加、减、数乘、点乘、叉乘。实现这些运算法则需要我们自己实现操作符的重载。
* 成员函数方面，除了问题中提到的计算向量长度`length()`和归一化`normalize()`*（归一化，可以简单的理解为将向量化为单位向量，但是归一化这一概念，在机器学习领域中有更深刻的含义）*,我在这里增加了个print的成员函数，用于美观地打印向量值，方便测试。

### 类的构成

* **总结一下，大致这个Vector3f的类的成员函数，成员有这些**

````c++
#pragma once
#include "Point.h"
class Vector3f
{
public:
//这里存放了类的构建函数和析构函数
    Vector3f(void);
/*这里我又构建了另一个Point类，表示三维坐标系上的点，这个函数构建以start_point为起点，end_point为终点的向。
Point类一些运算法则和Vector3f其实是一样的。话说回来，点有加减这样的运算法则码，称其为以(0,0)为起点的向量更合适。*/
    Vector3f(const Point &, const Point &);

    Vector3f(float, float, float);

    Vector3f(const Vector3f &);

    ~Vector3f(void);
public:

    void print(void);

    float length(void);

    Vector3f &normalize(void);

    Vector3f &operator=(const Vector3f &);

    Vector3f &operator+=(const Vector3f &);

    Vector3f operator+(const Vector3f &);

    Vector3f &operator-=(const Vector3f &);

    Vector3f operator-(const Vector3f &);

    // 用来表示点乘
    float operator^(const Vector3f &);

    // 数乘
    Vector3f operator*(float);

    // 叉乘
    Vector3f operator%(const Vector3f &);
    /*“为了探索运算符重载的各种可能性，我在这里将`^`和`%`分别重载为点乘和叉乘。但在团队协作或开源项目中，为了代码的清晰易读，通常会使用**具名函数**，如`dot()`和`cross()`*/
private:
    float x, y, z;
};
}```
- 具体实现如下
```c++
#include "Vector3f.h"
#include <iostream>
#include <cmath>
// 默认生成零向量
Vector3f::Vector3f(void) : x(0), y(0), z(0)
{
}
  

Vector3f::Vector3f(const Point &start_point, const Point &end_point)
{
    x = (end_point - start_point).getX();

    y = (end_point - start_point).getY();

    z = (end_point - start_point).getZ();
}

Vector3f::Vector3f(const Vector3f &vector)
{
    *this = vector;
}

Vector3f::Vector3f(float x, float y, float z) : x(x), y(y), z(z)
{
}
Vector3f::~Vector3f(void)
{
}


Vector3f &Vector3f::operator=(const Vector3f &right)

{
    x = right.x;
    y = right.y;
    z = right.z;
    return *this;
}

Vector3f &Vector3f::operator+=(const Vector3f &right)
{
    x += right.x;
    y += right.y;
    z += right.z;
   return *this;
} 

Vector3f Vector3f::operator+(const Vector3f &right)
{
    return Vector3f(x + right.x, y + right.y, z + right.z);
}

Vector3f &Vector3f::operator-=(const Vector3f &right)
{
   x -= right.x;
    y -= right.y;
    z -= right.z;
    return *this;
}
Vector3f Vector3f::operator-(const Vector3f &right)
{
    return Vector3f(x - right.x, y - right.y, z - right.z);
}
Vector3f Vector3f::operator*(float n)
{
	return Vector3f(n * x, n * y, n * z);
}
float Vector3f::operator^(const Vector3f &right)
{
    float x_result = x * right.x;
    float y_result = y * right.y;
    float z_result = z * right.z;
    return (x_result + y_result + z_result);
}
  
Vector3f Vector3f::operator%(const Vector3f &right)
{
    float new_x = y * right.z - right.y * z;
    float new_y = -(x * right.z - right.x * z);
    float new_z = x * right.y - right.x * y;
    return Vector3f(new_x, new_y, new_z);
}
  
void Vector3f::print()
{
    std::cout << "(" << x << "," << y << "," << z << ")" << std::endl;
}

float Vector3f::length()
{
    return std::sqrt(x * x + y * y + z * z);
}

Vector3f &Vector3f::normalize()
{
	float len = length();
	if (len > 0) { // 防止除以零 
	 x /= len; 
	 y /= len;
	 z /= len;
	 return *this;
}
````

#### 技术细节

##### 1. 成员函数的排放顺序

* 将公共的接口放在前面，私有的成员放在后面。这种习惯在实际开发中方便对接人员找到接口。

##### 2. **带=号的，返回类型加上&**

* 第一个 &：Vector3f & (作为函数返回值)

* **含义**：这里的 Vector3f & 定义了 operator= 函数的**返回类型**。它意味着这个函数将返回一个 Vector3f 对象的**引用**。

* **目的**：返回引用的主要目的是实现**链式赋值 (chaining assignment)**。\
  例如，你可以写出这样的代码：	    \`\`\`
  Vector3f a, b, c;
  a = b = c;

* 这段代码会被解析为 a.operator=(b.operator=(c))。为了让 a.operator= 能够执行，b.operator=(c) 必须返回一个可以被赋值的对象，也就是 b 自身。通过返回 \*this 的引用（\*this 代表调用该成员函数的对象本身），b = c 的结果就是 b 自身的引用，然后这个引用可以继续用于对 a 的赋值

* 假如不返回对象的引用呢？

* 会造成如下几个问题
  1. **链式赋值 (a = b = c) 的工作机制变得低效且不符合预期。**

  2. **会产生不必要的对象复制，导致严重的性能开销。**

  3. **违反了 C++ 的核心设计惯例，使代码难以理解和维护**

* 举例

```c++
Vector3f Vector3f::operator+=(const Vector3f &right)
{
    x += right.x;
    y += right.y;
    z += right.z;
   return *this;
} 
```

* 考虑以下链式调用：

```c++
Vector3f a(1, 0, 0);
Vector3f b(2, 0, 0);
// 目标：将a和b相加，然后将结果（新的a）单位化
(a += b).normalize();
```

1. 影响一：不必要的对象复制和性能开销

   当写下 return \*this; 时，编译器会检查函数的返回类型。

   * **错误实现 (Vector3f)**：返回类型是 Vector3f，一个值。编译器会调用 Vector3f 的拷贝构造函数，创建一个 \*this 的**临时副本**，然后将这个副本返回。

   * **正确实现 (Vector3f&)**：返回类型是 Vector3f&，一个引用。编译器只会返回 \*this 的别名（本质上是一个地址），不会创建任何新对象。

   * **后果是什么？**

   对于一个简单的语句 v1 += v2;：

   1. v1 的值被正确更新 (x, y, z 都加上了 v2 相应的值)。

   2. 函数返回了一个 v1 的临时副本。

   3. 因为这个返回值没有被用在任何地方，所以这个临时副本马上就被销毁了。

   在这个简单场景下，代码的功能**表面上看起来是正确的**，但你为一次毫无用处的对象复制和销毁付出了性能代价。对于 Vector3f 这样的小对象，代价很小；但对于管理大量资源的类，代价将是巨大的。

2. 影响二：链式调用的行为错误 (这是一个更严重的BUG)

   这是返回值为值时最危险的陷阱。假设你的 Vector3f 类还有一个方法，比如 normalize()，用于将向量单位化。
   让我们分析两种实现下这行代码的行为：

   **1. 当 operator+= 返回 Vector3f (错误版本)**

   * a += b 被执行。a 的值变成了 (3, 0, 0)。

   * operator+= 返回了一个 a 的**临时副本**。这个副本的值也是 (3, 0, 0)。

   * .normalize() 方法被调用，但它是作用在这个**临时副本**上的！

   * 临时副本被单位化，它的值变成了 (1, 0, 0)。

   * 这行代码执行完毕后，临时副本被销毁。

   * **最终 a 的值仍然是 (3, 0, 0)**，它根本没有被 normalize() 影响到。这是一个非常隐蔽且危险的逻辑错误。

   **2. 当 operator+= 返回 Vector3f& (正确版本)**

   * a += b 被执行。a 的值变成了 (3, 0, 0)。

   * operator+= 返回了**一个指向 a 自身的引用**。

   * .normalize() 方法通过这个引用，被直接调用在 a 对象上。

   * a 被成功单位化。

   * **最终 a 的值变成了 (1, 0, 0)**。这完全符合预期。

* **核心准则：** 对于所有会修改对象自身状态的复合赋值运算符 (+=, -=, \*=, /=, =)，都应该返回 \*this 的引用 (ClassName&)。
* 但是 二元算术运算符 (+, -, \*, /)：不修改自身，应返回一个新对象 (ClassName) 来存储结果。通常实现为创建一个左操作数 (\*this) 的副本。这个副本将作为结果返回。可利用非成员函数或 const 成员函数，并基于对应的复合赋值运算符来构建。
  * 这类运算符的核心语义是：计算两个操作数的和，并返回这个和作为一个**全新的值**，而**不改变任何一个原始操作数**。
  * 因此，不能返回一个已存在的对象的引用。这个对象不能是左操作数（因为我们不能修改它），也不能是右操作数。那么唯一的可能是函数内部创建的局部变量。但是局部变量在函数执行结束后就会被销毁。
  * 同样的，不能出现函数内部用\*this+=right去实现+运算这种情况，因为这样会改变左操作数的值	\`\`\`
  ```c++
  // 注意函数末尾的 const，表示这个函数不会修改 \*this 对象
  Vector3f  Vector3f::operator+(const Vector3f &right) const
  {
      // 1. 创建一个左操作数 (\*this) 的副本。这个副本将作为结果返回。
      Vector3f result = \*this; 
      // 2. 使用已经实现的 operator+= 来修改这个副本。
      result += right; // 等价于 result.operator+=(right);
      // 3. 按值返回这个被修改后的副本。
      return result;
  }
  ```
  * 这是除前面给出外的另一种实现方法

###### 补充：& 符号在 C++ 中的基本含义

* 在 C++ 中，& 符号根据上下文有多种含义：

* **取地址运算符 (Address-of operator)**：当用在变量名前时（如 \&myVar），它会返回该变量的内存地址。

* **按位与运算符 (Bitwise AND operator)**：当用在两个整数之间时，它执行按位与操作。

* **引用声明 (Reference declarator)**：当用在类型名之后时（如 int&），它声明一个引用。

###### 总结：

|                                |                                      |                                           |
| ------------------------------ | ------------------------------------ | ----------------------------------------- |
| 特性                             | Vector3f& operator+= (返回引用 - **正确**) | Vector3f operator+= (返回值 - **错误**)        |
| **基本操作 a += b;**               | a被修改。高效。                             | a被修改。但创建了一个无用的临时返回值，有性能开销。                |
| **链式操作 (a += b).normalize();** | a被修改，然后a被normalize。**行为正确**。         | a被修改，但normalize作用于一个临时副本上，a本身未变。**行为错误**。 |
| **性能**                         | **极高**，无复制开销。                        | **较低**，每次调用都有不必要的对象复制和销毁开销。               |
| **惯例**                         | 符合C++标准库和内置类型的行为。                    | 违反惯例，可能导致意外的、难以调试的bug。                    |

##### 3. 如何实现"n\*vec"？

* 正如前言所说，操作符(operator)，可以被翻译为 a.operator(x);

* 当我要实现Vector\*float，编译器会将其解释为：  vec.operator\*(n)  ，这是一个对 vec 对象的成员函数调用，这是可行的。

* 但是，对于n \* vec，编译器会尝试将其解释为：  `n.operator*(vec)`  这里的 n 是一个 float，是 C++ 的内置类型。你不能给 float 添加成员函数 operator\*，所以这种方式从根本上就行不通。

###### 解决方案：使用非成员函数（自由函数）

* 要实现 n \* vec，你需要将 operator\* 重载为一个**非成员函数（non-member function）**，也叫自由函数或全局函数。

* 当编译器看到 n \* vec 时，如果它无法在 float 类型中找到成员函数，它就会去查找一个可以接受一个 float 和一个 Vector3f 作为参数的全局 operator\* 函数。

###### 实现步骤

* 你需要做两件事：
  1. **保留你的成员函数** 用于处理 vec \* n。

  2. **新增一个非成员函数** 用于处理 n \* vec。

为了让这个非成员函数能够访问 Vector3f 的私有成员（如 x, y, z），你还需要在类定义中将其声明为**友元 (friend)**。

```c++
#pragma once

class Vector3f
{
public:
    float x, y, z;

    // 构造函数
    Vector3f(float x = 0.0f, float y = 0.0f, float z = 0.0f);

    // 1. 成员函数版本，用于处理 vec * n
    Vector3f operator*(float s) const;

    // 2. 将非成员函数声明为友元，以允许它访问私有成员
    //    这个函数用于处理 n * vec
    friend Vector3f operator*(float s, const Vector3f& vec);
};
```

* 具体实现

```c++
#include "Vector3f.h"

Vector3f::Vector3f(float x, float y, float z) : x(x), y(y), z(z) {}

// 1. 成员函数 operator* 的实现 (vec * n)
//    注意末尾的 const，表示这个操作不应该修改原始向量 vec
Vector3f Vector3f::operator*(float s) const
{
    return Vector3f(this->x * s, this->y * s, this->z * s);
}

// 2. 非成员函数 operator* 的实现 (n * vec)
//    这个函数不属于任何类，所以没有 Vector3f:: 前缀
Vector3f operator*(float s, const Vector3f& vec)
{
    // 最优雅的实现方式是直接调用我们已经写好的成员函数版本，
    // 以避免重复代码。因为乘法满足交换律。
    return vec * s; 
    
    // 或者，你也可以直接实现，因为它是友元，可以访问私有成员：
    // return Vector3f(vec.x * s, vec.y * s, vec.z * s);
    // 但调用现有成员函数是更好的实践。
}
```

* 总结：
  1. **当你的类对象是左操作数时**：优先使用**成员函数**来实现运算符重载（例如 vec \* n）。
  2. **当你的类对象是右操作数，且左操作数是内置类型或其他类的对象时**：必须使用**非成员函数**（通常是全局函数）来实现（例如 n \* vec）。
  3. **访问权限**：如果非成员函数需要访问类的 private 或 protected 成员，请在类的定义中将其声明为 friend。
  4. **代码重用**：为了保持逻辑一致性并减少代码冗余，通常让非成员函数版本调用成员函数版本来实现其功能（如 return vec \* s;）。

#### 测试代码

* 创建`main.cpp`文件，作为自定义类和函数的测试程序

```c++
#include "Vector3f.h"
#include <iostream>
int main()
{
    Vector3f vec1 = Vector3f();
    vec1.print();
    Vector3f vec2 = Vector3f(0, 0, 1);
    Vector3f vec3 = vec2 * 3;
    vec3.print();
    Vector3f vec4 = Vector3f(1, 0, 0);
    (vec2 + vec4).print();
    (vec2 - vec4).print();
    (vec2 % vec4).print();
    std::cout << (vec2 ^ vec3) << std::endl;
    std::cout << vec3.length() << std::endl;
    vec3.normalize();
    vec3.print();
}
```

### 编译，调试，修改

* 写完后进行编译，这里我选择了用cmake编译，关于cmake相关内容可以看\[\[从手动编译到CMAKE]]
* 输出结果如下:![Pasted image 20250722194508.png](blog:/published-assets/646e085e00b164a561498015b5cb1bf99c60ef85035a327efb080234e555ba54.png)
* tips: 在我的源代码中没有实现"n\*vec"，实际上main函数也没有测试这个

***

## 总结

* 通过实现这样一个`Vector3f`向量类，了解了友元函数，运算符的重载相关的知识点。
